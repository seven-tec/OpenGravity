import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class FirestoreService {
  private db: admin.firestore.Firestore | null = null;
  private isInitialized = false;

  constructor(serviceAccountPath?: string) {
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
      // Usamos el ID de usuario para la colección de workouts, 
      // pero si es Pablo (855084566) lo guardamos en su ruta específica si así se prefiere.
      // Siguiendo el pedido del usuario: "users/855084566/workouts"
      const docRef = this.db.collection('users').doc(userId).collection('workouts').doc();
      await docRef.set({
        ...workout,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
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
