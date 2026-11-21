export type TopicId =
  | 'alertness' | 'attitude' | 'safety-vehicle' | 'safety-margins' | 'hazard-awareness'
  | 'vulnerable' | 'other-vehicles' | 'handling' | 'motorway' | 'rules'
  | 'signs' | 'documents' | 'incidents' | 'loading';

export interface Question {
  id: string;
  topic: TopicId;
  text: string;
  /** Option shown as correct. Options are shuffled when displayed. */
  answer: string;
  wrong: string[];
  explain: string;
  ref: string;
  sign?: string;
  /** Set for questions belonging to a scenario (case study). */
  scenario?: string;
}

export interface Topic {
  id: TopicId;
  name: string;
  short: string;
  /** Approximate number of questions from this topic in a 50-question mock. */
  mockWeight: number;
  lesson: { heading: string; points: string[] }[];
}

export interface Scenario {
  id: string;
  title: string;
  text: string;
  questions: Question[];
}
