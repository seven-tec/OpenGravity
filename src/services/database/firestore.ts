import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getEmbedding, cosineSimilarity } from '../../utils/embeddings.js';

export class FirestoreService {
  private db: admin.firestore.Firestore | null = null;
  private isInitialized = false;
  private hfToken?: string;

  constructor(serviceAccountPath?: string, hfToken?: string) {
    this.hfToken = hfToken;
    try {
      let serviceAccount: object | null = null;

      if (process.env.FIREBASE_CONFIG) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
          console.log('📡 [Firestore] Loading credentials from FIREBASE_CONFIG env var');
        } catch (parseError) {
          console.error('❌ [Firestore] Failed to parse FIREBASE_CONFIG:', (parseError as Error).message);
        }
      } else if (serviceAccountPath) {
        const filePath = join(process.cwd(), serviceAccountPath);
        if (existsSync(filePath)) {
          serviceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
          console.log('📁 [Firestore] Loading credentials from file:', serviceAccountPath);
        } else {
          console.warn(`⚠️ [Firestore] File not found: ${serviceAccountPath}`);
        }
      }

      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });

        this.db = admin.firestore();
        this.isInitialized = true;
        console.log('🔥 [Firestore] Connected successfully');
      } else {
        throw new Error('No valid Firebase credentials found');
      }
    } catch (error) {
      console.error('❌ [Firestore] Initialization failed:', (error as Error).message);
      console.log('⚠️ [Firestore] Running in offline mode (SQLite only)');
      console.log('   To enable Firestore:');
      console.log('   - Set FIREBASE_CONFIG environment variable (production)');
      console.log('   - Or place service-account.json in the working directory (local)');
    }
  }

  async addMessage(userId: string, role: string, content: string, toolCalls?: string): Promise<void> {
    if (!this.isInitialized || !this.db) return;

    try {
      const docRef = this.db.collection('contexts').doc(userId).collection('messages').doc();
      await docRef.set({
        role,
        content,
        toolCalls: toolCalls || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      this.handleFirestoreError(error);
    }
  }

  async setMemory(userId: string, key: string, value: string, importance: number = 1): Promise<void> {
    if (!this.isInitialized || !this.db) return;

    try {
      const docRef = this.db.collection('contexts').doc(userId).collection('memory').doc(key);
      await docRef.set({
        value,
        importance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      this.handleFirestoreError(error);
    }
  }
  
  async addWorkout(userId: string, workout: any): Promise<void> {
    if (!this.isInitialized || !this.db) return;

    try {
      const docRef = this.db.collection('users').doc(userId).collection('workouts').doc();
      await docRef.set({
        ...workout,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      this.handleFirestoreError(error);
    }
  }

  async saveKnowledge(userId: string, category: string, action: string, data: any): Promise<void> {
    if (!this.isInitialized || !this.db) return;

    try {
      if (action === "store" || action === "update") {
        let embedding: number[] | null = null;
        
        if (this.hfToken) {
          try {
            const textToEmbed = typeof data === 'string' ? data : (data.content || JSON.stringify(data));
            embedding = await getEmbedding(textToEmbed, this.hfToken);
            console.log(`[Firestore] Embedding generated for category: ${category}`);
          } catch (e) {
            console.warn('[Firestore] Failed to generate embedding, saving without it:', e);
          }
        }

        const collectionRef = this.db.collection('users').doc(userId).collection('knowledge').doc(category).collection('items');
        await collectionRef.add({
          ...data,
          embedding: embedding,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          metadata: { source: 'OpenGravity_Agent' }
        });
      }
    } catch (error) {
      this.handleFirestoreError(error);
    }
  }

  async saveTrace(userId: string, traceId: string, event: any): Promise<void> {
    if (!this.isInitialized || !this.db) return;

    try {
      const traceRef = this.db
        .collection('users')
        .doc(userId)
        .collection('traces')
        .doc(traceId)
        .collection('events');
      
      await traceRef.add({
        ...event,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error(`[Firestore] Failed to save trace event:`, (error as Error).message);
    }
  }

  async getErrorTraces(userId: string, limit: number = 10): Promise<any[]> {
    if (!this.isInitialized || !this.db) return [];
    try {
      const snapshot = await this.db
        .collection('contexts')
        .doc(userId)
        .collection('messages')
        .where('role', '==', 'assistant')
        .orderBy('createdAt', 'desc')
        .limit(limit * 2)
        .get();

      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((msg: any) => 
          msg.content.toLowerCase().includes('error') || 
          msg.content.toLowerCase().includes('falló') ||
          (msg.toolCalls && msg.toolCalls.includes('_toolError'))
        )
        .slice(0, limit);
    } catch (error) {
      this.handleFirestoreError(error);
      return [];
    }
  }

  async semanticSearch(userId: string, category: string, query: string, limit: number = 5): Promise<any[]> {
    if (!this.isInitialized || !this.db || !this.hfToken) {
      return this.queryKnowledge(userId, category, limit);
    }

    try {
      console.log(`[Firestore] Starting native semantic search in ${category} for: "${query}"`);
      const queryVector = await getEmbedding(query, this.hfToken);
      
      const collectionRef = this.db
        .collection('users')
        .doc(userId)
        .collection('knowledge')
        .doc(category)
        .collection('items');

      const vectorQuery = collectionRef.findNearest({
        vectorField: 'embedding',
        queryVector: queryVector,
        distanceMeasure: 'COSINE',
        limit: limit,
      });

      const snapshot = await vectorQuery.get();
      
      if (snapshot.empty) {
        console.log('[Firestore] Native vector search returned no results, trying manual fallback...');
        return this.manualSemanticSearchFallback(userId, category, queryVector, limit);
      }

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

    } catch (error: any) {
      const isIndexError = error.message.includes('FAILED_PRECONDITION') || error.message.includes('vector index');
      
      if (isIndexError) {
        console.error('❌ [Firestore] MISSING VECTOR INDEX!');
      } else {
        console.error('[Firestore] Native semantic search failed:', error.message);
      }
      
      try {
        const queryVector = await getEmbedding(query, this.hfToken);
        return this.manualSemanticSearchFallback(userId, category, queryVector, limit);
      } catch (err) {
        return this.queryKnowledge(userId, category, limit);
      }
    }
  }

  private async manualSemanticSearchFallback(userId: string, category: string, queryVector: number[], limit: number): Promise<any[]> {
    if (!this.db) return [];
    
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('knowledge')
      .doc(category)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    return docs
      .filter(doc => doc.embedding && Array.isArray(doc.embedding))
      .map(doc => ({
        ...doc,
        similarity: cosineSimilarity(queryVector, doc.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  async queryKnowledge(userId: string, category: string, limit: number = 5): Promise<any[]> {
    if (!this.isInitialized || !this.db) return [];

    try {
      const snapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('knowledge')
        .doc(category)
        .collection('items')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }));
    } catch (error) {
      this.handleFirestoreError(error);
      return [];
    }
  }

  async clearMessages(userId: string): Promise<void> {
    if (!this.isInitialized || !this.db) return;
    try {
      const batch = this.db.batch();
      const snapshot = await this.db.collection('contexts').doc(userId).collection('messages').get();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      this.handleFirestoreError(error);
    }
  }

  async getRecentMessages(userId: string, limit: number): Promise<any[]> {
    if (!this.isInitialized || !this.db) return [];

    try {
      const snapshot = await this.db
        .collection('contexts')
        .doc(userId)
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }));
    } catch (error) {
      this.handleFirestoreError(error);
      return [];
    }
  }

  private handleFirestoreError(error: any): void {
    const message = (error as Error).message;
    
    if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API has not been used')) {
      console.warn('⚠️ [Firestore] API is disabled or permissions are missing. Falling back to SQLite only for this session.');
      this.isInitialized = false;
    } else {
      console.error('❌ [Firestore] Operation failed:', message);
    }
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}
