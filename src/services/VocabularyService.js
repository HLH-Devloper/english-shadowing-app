import { db } from '../firebase'
import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    getDoc
} from 'firebase/firestore'

const COLLECTION_NAME = 'vocabulary'

export const VocabularyService = {
    /**
     * 添加生词到用户的生词本
     * @param {string} userId 用户ID
     * @param {object} wordData 单词数据 { word, definition, phonetic, context, translation, source }
     */
    async addWord(userId, wordData) {
        if (!userId) throw new Error('User ID is required')

        // 1. 检查是否已存在
        const exists = await this.checkWordExists(userId, wordData.word)
        if (exists) {
            return { success: false, message: '这个单词已经在你的生词本里啦 ✨' }
        }

        // 2. 添加新词
        try {
            const userVocabRef = collection(db, 'users', userId, COLLECTION_NAME)
            await addDoc(userVocabRef, {
                ...wordData,
                masteryLevel: 0, // 0-5, 0 = new
                nextReview: serverTimestamp(), // 立即可以复习
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })
            return { success: true, message: '成功加入生词本！加油记忆哦 💪' }
        } catch (error) {
            console.error('Error adding word:', error)
            throw new Error('保存失败，请稍后重试')
        }
    },

    /**
     * 检查单词是否已存在
     */
    async checkWordExists(userId, word) {
        if (!userId || !word) return false
        const q = query(
            collection(db, 'users', userId, COLLECTION_NAME),
            where('word', '==', word)
        )
        const snapshot = await getDocs(q)
        return !snapshot.empty
    },

    /**
     * 获取用户的所有生词
     */
    async getWords(userId) {
        if (!userId) return []
        try {
            const q = query(
                collection(db, 'users', userId, COLLECTION_NAME),
                orderBy('createdAt', 'desc')
            )
            const snapshot = await getDocs(q)
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        } catch (error) {
            console.error('Error fetching words:', error)
            return []
        }
    },

    /**
     * 更新单词掌握程度 (0-5)
     * 简单算法：
     * Level 0: 新词
     * Level 1: 认识 (1天后复习)
     * Level 2: 熟悉 (3天后复习)
     * Level 3: 掌握 (7天后复习)
     * Level 4: 牢记 (14天后复习)
     * Level 5: 永久 (30天后复习)
     */
    async updateMastery(userId, wordId, currentLevel, isRemembered) {
        if (!userId || !wordId) return

        let newLevel = currentLevel
        if (isRemembered) {
            newLevel = Math.min(5, currentLevel + 1)
        } else {
            newLevel = Math.max(0, currentLevel - 1)
        }

        // 计算下次复习时间
        const now = new Date()
        let nextReviewDate = new Date()
        const intervals = [0, 1, 3, 7, 14, 30] // days
        nextReviewDate.setDate(now.getDate() + intervals[newLevel])

        try {
            const wordRef = doc(db, 'users', userId, COLLECTION_NAME, wordId)
            await updateDoc(wordRef, {
                masteryLevel: newLevel,
                nextReview: nextReviewDate,
                updatedAt: serverTimestamp()
            })
            return newLevel
        } catch (error) {
            console.error('Error updating mastery:', error)
            throw error
        }
    },

    /**
     * 删除生词
     */
    async deleteWord(userId, wordId) {
        if (!userId || !wordId) return
        try {
            await deleteDoc(doc(db, 'users', userId, COLLECTION_NAME, wordId))
            return { success: true, message: '已从生词本移除 👋' }
        } catch (error) {
            console.error('Error deleting word:', error)
            throw error
        }
    }
}
