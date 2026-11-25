// Page « Current Room » : check-in de salle de la démo networking (auparavant un bloc de My profile).
// Choix manuel, Detect room (OCR du panneau), Scan QR code, audience du check-in, durée 1 h.
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import type { Program } from "../api/program";
import { CheckInPanel } from "./sharing";
import { useNetworking } from "./NetworkingContext";
import { NetworkingFrame } from "./ui";

export function CurrentRoom({
  p,
  onOpenMenu,
  incomingRoom,
  onRoomConsumed,
}: {
  p: Program;
  onOpenMenu: () => void;
  incomingRoom: string | null;
  onRoomConsumed: () => void;
}) {
  const { event, me, busy, recipients, change } = useNetworking();
  const [prefilledRoom, setPrefilledRoom] = useState<string | null>(null);

  useEffect(() => setPrefilledRoom(null), [event.id]);

  // QR de salle (#chi26-room=…) : présélectionne la salle, à confirmer.
  useEffect(() => {
    if (!incomingRoom || !event.roomReaders || !me) return;
    setPrefilledRoom(incomingRoom);
    onRoomConsumed();
  }, [incomingRoom, event.roomReaders, me, onRoomConsumed]);

  return (
    <NetworkingFrame
      p={p}
      title="Current Room"
      onOpenMenu={onOpenMenu}
      intro={incomingRoom && <p className="captureResult">Room QR · {incomingRoom}. Create a profile to check in.</p>}
    >
      {me && (
        <div className="reading simpleProfile" key={me.id}>
          <section className="panel profileMain" aria-labelledby="current-room-title">
            <div className="roomHeading">
              <MapPin size={19} aria-hidden="true" />
              <h2 id="current-room-title">Current room</h2>
              <small>{me.checkIn ? me.checkIn.room : "No active check-in"}</small>
            </div>
            <CheckInPanel
              event={event}
              key={prefilledRoom || me.id}
              prefilledRoom={prefilledRoom}
              me={me}
              people={recipients}
              change={change}
              busy={busy}
            />
          </section>
        </div>
      )}
    </NetworkingFrame>
  );
}
