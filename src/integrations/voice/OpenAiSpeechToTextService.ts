export interface SpeechToTextInput {
  audio: Buffer
  filename: string
  mimeType?: string
}

export interface SpeechToTextService {
  transcribe(input: SpeechToTextInput): Promise<string>
}

function inferMimeType(filename: string, mimeType?: string): string {
  if (mimeType?.trim()) {
    return mimeType.trim()
  }

  const lower = filename.toLowerCase()
  if (lower.endsWith(".ogg")) return "audio/ogg"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  if (lower.endsWith(".wav")) return "audio/wav"

  return "application/octet-stream"
}

export class OpenAiSpeechToTextService implements SpeechToTextService {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async transcribe(input: SpeechToTextInput): Promise<string> {
    const form = new FormData()
    form.set(
      "file",
      new Blob([new Uint8Array(input.audio)], { type: inferMimeType(input.filename, input.mimeType) }),
      input.filename
    )
    form.set("model", this.model)
    form.set("response_format", "json")

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(`Transcription indisponible (${response.status}): ${details.slice(0, 200)}`)
    }

    const data = (await response.json()) as { text?: string }
    const text = data.text?.trim()

    if (!text) {
      throw new Error("La transcription n'a retourné aucun texte.")
    }

    return text
  }
}
