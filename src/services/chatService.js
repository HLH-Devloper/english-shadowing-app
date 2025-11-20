import { db } from '../firebase'
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, query, where, orderBy, serverTimestamp, limit } from 'firebase/firestore'

const COLLECTION_NAME = 'conversations'

export const ChatHistoryService = {
    /**
     * Create a new conversation or update an existing one
     * @param {string} userId - The user's ID
     * @param {object} conversationData - The conversation data
     * @param {string} [conversationId] - Optional ID to update existing doc
     * @returns {Promise<string>} - The conversation ID
     */
    async saveConversation(userId, conversationData, conversationId = null) {
        try {
            const dataToSave = {
                ...conversationData,
                userId,
                updatedAt: serverTimestamp(),
            }

            if (conversationId) {
                const docRef = doc(db, COLLECTION_NAME, conversationId)
                await updateDoc(docRef, dataToSave)
                return conversationId
            } else {
                dataToSave.createdAt = serverTimestamp()
                const docRef = await addDoc(collection(db, COLLECTION_NAME), dataToSave)
                return docRef.id
            }
        } catch (error) {
            console.error('Error saving conversation:', error)
            throw error
        }
    },

    /**
     * Get all conversations for a user
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    async getUserConversations(userId) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('userId', '==', userId),
                orderBy('updatedAt', 'desc'),
                limit(50)
            )

            const querySnapshot = await getDocs(q)
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        } catch (error) {
            console.error('Error fetching conversations:', error)
            throw error
        }
    },

    /**
     * Get a specific conversation by ID
     * @param {string} conversationId 
     * @returns {Promise<object|null>}
     */
    async getConversationById(conversationId) {
        try {
            const docRef = doc(db, COLLECTION_NAME, conversationId)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() }
            } else {
                return null
            }
        } catch (error) {
            console.error('Error fetching conversation:', error)
            throw error
        }
    }
}
