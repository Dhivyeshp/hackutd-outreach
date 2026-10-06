/** Renders an email exactly as it will be sent. HTML goes in a fully sandboxed iframe (no scripts, no same-origin). */
export function EmailPreview({ html, text, isHtmlTemplate, height = 520 }: { html: string; text: string; isHtmlTemplate: boolean; height?: number }) {
  if (isHtmlTemplate) {
    return (
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={html}
        className="w-full rounded-xl border border-white/10 bg-white"
        style={{ height }}
      />
    );
  }
  return <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-4 font-sans text-sm text-zinc-300">{text}</pre>;
}
