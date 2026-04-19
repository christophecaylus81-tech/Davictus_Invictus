export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ConversationProjectFocus {
  id: string
  title: string
}

interface ConversationState {
  dayKey: string
  history: ConversationMessage[]
  currentProject: ConversationProjectFocus | null
}

const MAX_HISTORY = 8
const DAY_TIMEZONE = 'Europe/Paris'

export class ConversationManager {
  private readonly states = new Map<string, ConversationState>()

  add(chatId: string, role: 'user' | 'assistant', content: string): void {
    const state = this.ensureState(chatId)
    state.history.push({ role, content, timestamp: Date.now() })

    if (state.history.length > MAX_HISTORY) {
      state.history.splice(0, state.history.length - MAX_HISTORY)
    }
  }

  get(chatId: string): ConversationMessage[] {
    return this.ensureState(chatId).history
  }

  clear(chatId: string): void {
    this.states.delete(chatId)
  }

  getCurrentProject(chatId: string): ConversationProjectFocus | null {
    return this.ensureState(chatId).currentProject
  }

  setCurrentProject(chatId: string, project: ConversationProjectFocus): void {
    const state = this.ensureState(chatId)
    state.currentProject = project
  }

  clearCurrentProject(chatId: string): void {
    const state = this.ensureState(chatId)
    state.currentProject = null
  }

  private ensureState(chatId: string): ConversationState {
    const today = this.getDayKey()
    const current = this.states.get(chatId)

    if (!current || current.dayKey !== today) {
      const nextState: ConversationState = {
        dayKey: today,
        history: [],
        currentProject: null
      }
      this.states.set(chatId, nextState)
      return nextState
    }

    return current
  }

  private getDayKey(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DAY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
  }
}
