import yokohama from "./chi25-program.json";
import { conference, papers, rooms, sessions } from "./demo-fixtures";

export const defaultConference = {
  ...conference,
  papers,
  sessions,
  rooms,
  location: "Barcelona, Spain",
  zone: "CEST",
  year: 2026,
  home: "https://chi2026.acm.org/",
  logo: "conference.png",
  roomReaders: true,
};

export const conferences = [
  defaultConference,
  {
    id: "chi25-demo",
    name: "CHI ’25",
    city: "Yokohama",
    year: 2025,
    location: "Yokohama, Japan",
    dates: "April 26–May 1, 2025",
    zone: "JST",
    home: "https://chi2025.acm.org/",
    logo: "conference-2025.png",
    edition: "Curated conference program",
    source: "https://programs.sigchi.org/chi/2025/program",
    ...yokohama,
    rooms: [...new Set(yokohama.sessions.map((s) => s.room))].sort(),
    roomReaders: false,
  },
];

export type DemoConference = (typeof conferences)[number];
export const conferencePrefix = (id: string) => "conferences/" + id + "/";
export function conferenceForPath(path: string) {
  const id = /^\/?conferences\/([^/]+)\//.exec(path)?.[1];
  return conferences.find((c) => c.id === id);
}
