// Types du programme public (URL : SIGCHI_PROGRAM_URL dans .env)
// Déduits du programme CHI 2026 (schemeVersion 7). Non documentés officiellement.

export type Id = number;
export type Timestamp = number; // ms epoch UTC

export interface Conference {
  id: Id;
  shortName: string;
  displayShortName?: string;
  year: number;
  name: string;
  fullName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  url?: string;
  location?: string;
  timeZoneOffset: number; // minutes
  timeZoneName: string; // ex. "Europe/Brussels"
  logoUrl?: string;
  accessibilityFaqUrl?: string;
}

export interface PublicationInfo {
  publicationStatus: string;
  isProgramEnabled: boolean;
  isDraft: boolean;
  version?: number;
  publicationDate?: string;
  [k: string]: unknown;
}

export interface ProgramListEntry {
  conference: Conference;
  publicationInfo: PublicationInfo;
}

export interface Affiliation {
  institution: string;
  city?: string;
  state?: string;
  country?: string;
  dsl?: string;
}

export interface Person {
  id: Id;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  affiliations: Affiliation[];
}

export interface Author {
  personId: Id;
  affiliations: Affiliation[];
}

export interface Addon {
  name: string;
  title?: string;
  type: string;
  url?: string;
}

export interface Content {
  id: Id;
  typeId: Id;
  trackId: Id;
  title: string;
  abstract?: string;
  authors: Author[];
  sessionIds: Id[];
  eventIds: Id[];
  tags: string[];
  keywords: string[];
  recognitionIds: Id[];
  award?: string;
  isBreak: boolean;
  durationOverride?: number;
  addons?: Record<string, Addon>;
}

export interface Session {
  id: Id;
  name: string;
  description?: string;
  typeId: Id;
  roomId?: Id;
  timeSlotId?: Id;
  chairIds: Id[];
  contentIds: Id[];
  isParallelPresentation: boolean;
}

export interface ConfEvent {
  id: Id;
  name: string;
  description?: string;
  typeId: Id;
  roomId: Id;
  startDate: Timestamp;
  endDate: Timestamp;
  chairIds: Id[];
  presenterIds: Id[];
  contentIds: Id[];
  isParallelPresentation: boolean;
}

export interface TimeSlot {
  id: Id;
  type: "SESSION" | "BREAK" | "LUNCH" | string;
  startDate: Timestamp;
  endDate: Timestamp;
}

export interface Room {
  id: Id;
  name: string;
  typeId?: Id;
  setup?: string;
  capacity?: number;
  note?: string;
}

export interface Floor {
  id: Id;
  name: string;
  mapImageUrl?: string;
  roomIds: Id[];
}

export interface Track {
  id: Id;
  name: string;
}

export interface ContentType {
  id: Id;
  name: string;
  displayName?: string;
  color: string;
  duration?: number;
}

export interface RawProgram {
  schemeVersion: number;
  conference: Conference;
  publicationInfo: PublicationInfo;
  sessions: Session[];
  events: ConfEvent[];
  contents: Content[];
  people: Person[];
  timeSlots: TimeSlot[];
  rooms: Room[];
  floors: Floor[];
  tracks: Track[];
  contentTypes: ContentType[];
  sponsors: unknown[];
  sponsorLevels: unknown[];
  recognitions: unknown[];
}

// --- API cloud authentifiée (URL : SIGCHI_CLOUD_READ_URL dans .env) ---

export interface MyScheduleContent {
  isAdded: boolean;
  actionDate: Timestamp;
  contentId: Id;
}

export interface MyScheduleSession {
  isAdded: boolean;
  actionDate: Timestamp;
  conferenceId: Id;
  sessionId: Id;
  myScheduleContents: MyScheduleContent[];
}

export interface MyListItem {
  isAdded: boolean;
  actionDate: Timestamp;
  conferenceId: Id;
  contentId: Id;
}

export interface MyList {
  id: string; // UUID ou "default"
  name: string;
  isDefault: boolean;
  isDeleted: boolean;
  actionDate: Timestamp;
  myListItems: MyListItem[];
}

export interface CloudReadAllResponse {
  myScheduleSessions: MyScheduleSession[];
  myLists: MyList[];
}
