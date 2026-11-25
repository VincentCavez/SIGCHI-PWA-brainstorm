import program from "./chi26-program.json";
export const conference = {
  id: "chi26-demo",
  name: "CHI ’26",
  city: "Barcelona",
  dates: "April 13–17, 2026",
  edition: "Curated conference program",
  source: "https://programs.sigchi.org/chi/2026/program",
};
export const { papers, sessions } = program;
// Salles des sessions de la démo, plus P1 - Room 125 (salle réelle du programme CHI 2026, utilisée par le profil John Doe).
export const rooms = [...new Set([...sessions.map((s) => s.room), "P1 - Room 125"])].sort();
export type Links = { website: string; scholar: string };
type Affiliation = {
  affiliation: string;
  role?: string;
  city?: string;
};
export function profileAffiliation({ affiliation, role, city }: Affiliation) {
  const position = [role, affiliation].filter(Boolean).join(", ");
  return [position, city].filter(Boolean).join(" · ");
}
export type Person = Affiliation & {
  id: string;
  name: string;
  bio: string;
  topics: string[];
  color: string;
  authorKey: string;
  links: Links;
  profileVisible: boolean;
  listVisible: boolean;
  listName: string;
  saved: string[];
  going: string[];
  shared: string[];
};
type Background = Affiliation & {
  id: string;
  name: string;
  bio: string;
  topics: string[];
  color: string;
  authorKey: string;
  links: Links;
  source: string;
  recommended: string[];
  reason: string;
  otherWork?: { title: string; venue: string; url: string };
  orcid?: string;
};
export const backgrounds: Background[] = [
  {
    id: "anran",
    name: "Anran Xu",
    affiliation: "RIKEN Center for Advanced Intelligence Project",
    bio: "Anran studies how people make privacy decisions about images and how interactive AI systems can support those decisions.",
    topics: ["Privacy", "Human–AI interaction", "Usable security"],
    color: "lilac",
    authorKey: "",
    links: { website: "https://anranxu.com/", scholar: "" },
    source: "https://anranxu.com/",
    recommended: ["222959", "221960"],
    reason:
      "Visual privacy controls and explanations of privacy policies connect to Anran’s work on how people understand and manage privacy.",
    otherWork: {
      title:
        "Examining Human Perception of Generative Content Replacement in Image Privacy Protection",
      venue: "CHI 2024",
      url: "https://doi.org/10.1145/3613904.3642103",
    },
  },
  {
    id: "carla",
    name: "Carla Griggio",
    affiliation: "Aalborg University",
    bio: "Carla studies how people maintain relationships across messaging apps and how interoperability changes privacy and social boundaries. She serves as SIGCHI’s VP for Operations.",
    topics: ["Messaging", "Privacy", "Social computing"],
    color: "teal",
    authorKey: "",
    links: {
      website: "https://carlagriggio.com/",
      scholar: "https://scholar.google.com/citations?user=1S79G5AAAAAJ",
    },
    source: "https://carlagriggio.com/",
    orcid: "https://orcid.org/0000-0001-9133-3828",
    recommended: ["222912", "230142"],
    reason:
      "Unsent messages and the boundaries of group chats connect to Carla’s research on interpersonal messaging.",
    otherWork: {
      title:
        "User Perceptions and Attitudes Toward Untraceability in Messaging Platforms",
      venue: "PoPETs 2026",
      url: "https://doi.org/10.56553/popets-2026-0007",
    },
  },
  {
    id: "gonzalo",
    name: "Gonzalo Gabriel Méndez",
    affiliation: "HASP Lab",
    city: "València",
    bio: "Gonzalo develops tools for authoring visualizations and studies how visual interfaces can give people more control over privacy in AI systems.",
    topics: ["Visualization", "Privacy", "Human–AI interaction"],
    color: "rose",
    authorKey: "218070",
    links: { website: "https://hasp-lab.github.io/members/", scholar: "" },
    source: "https://hasp-lab.github.io/members/",
    recommended: ["222959"],
    reason:
      "This paper offers another example of using an interface to make privacy choices tangible.",
  },
  {
    id: "nathalie",
    name: "Nathalie Bressa",
    affiliation: "Télécom Paris, Institut Polytechnique de Paris",
    bio: "Nathalie studies situated visualization, physical representations of data, and ways to use visualizations for data input.",
    topics: ["Visualization", "Data physicalization", "Interaction design"],
    color: "blue",
    authorKey: "214665",
    links: {
      website: "https://www.bressa.de/",
      scholar: "https://scholar.google.com/citations?user=H12w2vgAAAAJ",
    },
    source: "https://www.bressa.de/",
    recommended: ["222312"],
    reason:
      "This full paper studies how children make sense of data through embodied interaction with physicalizations.",
  },
  {
    id: "vincent",
    name: "Vincent Cavez",
    affiliation: "Stanford University",
    role: "Postdoctoral scholar",
    bio: "Vincent studies pen-based interaction and creative tools, including how musicians annotate scores and how people learn with AI and sketching interfaces.",
    topics: [
      "Pen-based interaction",
      "Creativity support",
      "Human–AI interaction",
    ],
    color: "amber",
    authorKey: "228755",
    links: {
      website: "https://www.vincentcavez.com/",
      scholar: "https://scholar.google.com/citations?user=JSY1rtEAAAAJ",
    },
    source: "https://www.vincentcavez.com/",
    recommended: ["222678"],
    reason:
      "This full paper combines pen-based document annotation with human–AI collaboration.",
  },
  {
    id: "yun",
    name: "Yun Huang",
    affiliation: "University of Illinois Urbana-Champaign",
    bio: "Yun co-directs the Social Computing Systems Lab and studies crowdsourcing and human–AI collaboration. Her PapersClaw.fun project explores paper and people discovery at conferences.",
    topics: ["Social computing", "Human–AI interaction", "Crowdsourcing"],
    color: "mint",
    authorKey: "217367",
    links: { website: "https://yunhuang.web.illinois.edu/", scholar: "" },
    source: "https://ischool.illinois.edu/people/yun-huang",
    recommended: ["222678"],
    reason:
      "This paper offers a related perspective on designing tools for human–AI collaboration.",
  },
];
export const people: Person[] = backgrounds.map((b, i) => {
  const authored = papers
    .filter((p) => p.authors.includes(b.authorKey))
    .map((p) => p.id);
  const saved = [...new Set([...b.recommended, ...authored.slice(0, 2)])];
  const going = sessions
    .filter((s) => s.papers.some((id) => saved.includes(id)))
    .slice(0, 2)
    .map((s) => s.id);
  return {
    id: b.id,
    name: b.name,
    affiliation: b.affiliation,
    role: b.role,
    city: b.city,
    bio: b.bio,
    topics: b.topics,
    color: b.color,
    authorKey: b.authorKey,
    links: b.links,
    profileVisible: true,
    listVisible: i !== 2,
    listName: "Demo reading list",
    saved,
    going,
    shared: i % 2 === 1 ? going.slice(0, 1) : [],
  };
});
export const personas = [
  ...people.map(({ id, name }) => ({ id, name })),
  { id: "guest", name: "Unregistered guest" },
];
export const fixtureNote =
  "Research profiles summarize public sources. Papers and session details come from the CHI 2026 program. Reading lists, plans, messages and historical-conference room check-ins are simulated. A name-only profile is private by default.";
