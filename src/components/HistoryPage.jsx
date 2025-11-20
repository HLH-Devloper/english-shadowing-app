import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { ChatHistoryService } from '../services/chatService'

const Container = styled.div`
  min-height: 100vh;
  background: #0f172a;
  color: #f8fafc;
  padding: 20px;
  font-family: 'Inter', sans-serif;
`

const Header = styled.header`
  display: flex;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  cursor: pointer;
  margin-right: 20px;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`

const Title = styled.h1`
  font-size: 1.5rem;
  margin: 0;
  background: linear-gradient(to right, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
`

const Card = styled.div`
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    background: rgba(30, 41, 59, 0.9);
    border-color: #38bdf8;
  }
`

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
`

const CardTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: #f8fafc;
`

const DateText = styled.span`
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
`

const Preview = styled.p`
  margin: 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Tag = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  font-size: 0.75rem;
  margin-top: 12px;
  margin-right: 8px;
`

const Loading = styled.div`
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
`

export default function HistoryPage() {
    const navigate = useNavigate()
    const [conversations, setConversations] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const list = await ChatHistoryService.getUserConversations(user.uid)
                    setConversations(list)
                } catch (error) {
                    console.error('Failed to load conversations:', error)
                } finally {
                    setLoading(false)
                }
            } else {
                setLoading(false)
                // Optional: redirect to login
            }
        })
        return () => unsub()
    }, [])

    const handleSelect = (id) => {
        navigate('/conversation', { state: { sessionId: id } })
    }

    return (
        <Container>
            <Header>
                <BackButton onClick={() => navigate('/conversation')}>←</BackButton>
                <Title>Chat History</Title>
            </Header>

            {loading ? (
                <Loading>Loading history...</Loading>
            ) : conversations.length === 0 ? (
                <Loading>No conversation history found.</Loading>
            ) : (
                <List>
                    {conversations.map(conv => (
                        <Card key={conv.id} onClick={() => handleSelect(conv.id)}>
                            <CardHeader>
                                <CardTitle>{conv.title || 'Untitled Chat'}</CardTitle>
                                <DateText>
                                    {conv.updatedAt?.seconds
                                        ? new Date(conv.updatedAt.seconds * 1000).toLocaleDateString()
                                        : 'Just now'}
                                </DateText>
                            </CardHeader>
                            <Preview>
                                {conv.messages && conv.messages.length > 0
                                    ? conv.messages[conv.messages.length - 1].text
                                    : 'No messages'}
                            </Preview>
                            <div>
                                <Tag>{conv.scenario}</Tag>
                                <Tag>{conv.difficulty}</Tag>
                            </div>
                        </Card>
                    ))}
                </List>
            )}
        </Container>
    )
}
