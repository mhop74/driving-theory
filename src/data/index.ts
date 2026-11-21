import { alertness, attitude, safetyVehicle, safetyMargins } from './bank1';
import { hazardAwareness, vulnerable, otherVehicles, handling } from './bank2';
import { motorway, rules, signs, documents, incidents, loading } from './bank3';
import { scenarioQuestions } from './scenarios';
import type { Question } from './types';
import { signQuestions } from './signQuestions';

const WRITTEN: Question[] = [
  ...alertness, ...attitude, ...safetyVehicle, ...safetyMargins, ...hazardAwareness, ...vulnerable,
  ...otherVehicles, ...handling, ...motorway, ...rules, ...signs, ...documents, ...incidents, ...loading,
];

/** Standalone questions (excluding scenario questions), plus one question per remaining official sign. */
export const QUESTIONS: Question[] = [...WRITTEN, ...signQuestions(WRITTEN)];

export const ALL_QUESTIONS: Question[] = [...QUESTIONS, ...scenarioQuestions];
export const questionById = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export { TOPICS, topicById } from './topics';
export { SCENARIOS } from './scenarios';
