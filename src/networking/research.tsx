import React from "react";
import { backgrounds } from "./lib/demo-fixtures";
import type { DemoConference } from "./lib/conferences";
export function Research({ id }: { id: string; event?: DemoConference }) {
  // Les contributions de l'année sont dans la tuile ConferencePublications (vrai programme) ;
  // la lecture suggérée de la démo est retirée.
  const b = backgrounds.find((p) => p.id === id);
  if (!b) return null;
  return (
    <section className="research">
      <h3>Research and publications</h3>
      <p>{b.bio}</p>
      <div className="sourceLinks">
        <a href={b.source} target="_blank" rel="noreferrer">
          Research profile
        </a>
        {b.id === "yun" && (
          <a
            href="https://ischool.illinois.edu/news-events/news/2026/04/new-app-designed-improve-conference-experience"
            target="_blank"
            rel="noreferrer"
          >
            PapersClaw project
          </a>
        )}
      </div>
      {b.otherWork && (
        <>
          <h4>Selected publication</h4>
          <ul>
            <li>
              <small>{b.otherWork.venue}</small>
              <a href={b.otherWork.url} target="_blank" rel="noreferrer">
                {b.otherWork.title}
              </a>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
