import { AppRouter } from './app/router'
import { IbtikarChatWidget } from './components/chatbot/IbtikarChatWidget'
import { AppErrorBoundary } from './components/errors/AppErrorBoundary'

function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
      <IbtikarChatWidget />
    </AppErrorBoundary>
  )
}

export default App

