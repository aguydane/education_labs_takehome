/** A quiet link back to the exchange a quote came from. */
export default function ShowInChat({ testId, onClick }: { testId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      title="Scroll the chat to this exchange"
      className="text-xs text-ink-2 underline decoration-dotted underline-offset-2 hover:text-ink"
    >
      Show in chat
    </button>
  );
}
