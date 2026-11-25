// Page « Messages » de la démo networking (portage de components/network-ui.tsx).
// On ne peut écrire qu'aux personnes qui voient notre profil ; les messages restent dans le navigateur.
import type { Program } from "../api/program";
import { useState } from "react";
import { MessagesSquare, Send } from "lucide-react";
import { useNetworking } from "./NetworkingContext";
import { Avatar, NetworkingFrame } from "./ui";

export function Messages({ p, onOpenMenu, openProfile }: { p: Program; onOpenMenu: () => void; openProfile: () => void }) {
  const { view, me, viewer, busy, sendMessage } = useNetworking();
  const [thread, setThread] = useState<string | null>(null);
  const [text, setText] = useState("");
  const external = (view?.directory ?? []).filter((p) => p.id !== viewer);
  const current = external.find((p) => p.id === thread);
  const messages = (view?.messages ?? []).filter((m) => m.sender === thread || m.recipient === thread);

  return (
    <NetworkingFrame p={p} title="Messages" onOpenMenu={onOpenMenu}>
      {me && (
        <div className="chatLayout">
          <section className="panel contacts">
            <h2>Conversations</h2>
            {external.length === 0 && <p>No attendee shares a profile with you yet.</p>}
            {external.map((p) => (
              <button
                key={p.id}
                className={thread === p.id ? "selected" : ""}
                onClick={() => {
                  setThread(p.id);
                  setText("");
                }}
              >
                <Avatar name={p.name} color={p.color} />
                <span>{p.name}</span>
              </button>
            ))}
          </section>
          <section className="panel chat">
            {current ? (
              <>
                <h2>{current.name}</h2>
                <div className="chatBody">
                  {messages.length === 0 && <p>No messages yet.</p>}
                  {messages.map((m) => (
                    <div key={m.id} className={"bubble " + (m.sender === viewer ? "mine" : "")}>
                      <small>{m.sender === viewer ? "You" : current.name}</small>
                      {m.body}
                    </div>
                  ))}
                </div>
                {!me.profileVisible ? (
                  <div className="inlineNotice">
                    Make your profile visible to start a conversation.{" "}
                    <button className="textBtn" onClick={openProfile}>
                      Open my profile
                    </button>
                  </div>
                ) : (
                  <form
                    className="formRow"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!text.trim() || busy) return;
                      if (await sendMessage(current.id, text)) setText("");
                    }}
                  >
                    <input
                      aria-label="Message text"
                      value={text}
                      maxLength={1000}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Write a demo message"
                    />
                    <button className="primary" disabled={busy || !text.trim()}>
                      <Send size={16} />
                      Send
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="empty">
                <MessagesSquare />
                <h3>Select an attendee</h3>
                <p>Messages stay in this browser. Only people who can see your profile can receive them.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </NetworkingFrame>
  );
}
