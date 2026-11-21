import type { Question, Scenario, TopicId } from './types';

// In the real test this part is a short video clip with 3 questions.
// Here it is a written scenario with 3 questions on the same situation.
type SQ = [TopicId, string, string, string[], string, string];

function sc(id: string, title: string, text: string, qs: SQ[]): Scenario {
  const questions: Question[] = qs.map(([topic, q, answer, wrong, explain, ref], i) => ({
    id: `scn-${id}-${i + 1}`, topic, text: q, answer, wrong, explain, ref, scenario: id,
  }));
  return { id, title, text, questions };
}

export const SCENARIOS: Scenario[] = [
  sc('school-run', 'School run in town',
    'It is 8.30 am on a wet weekday. You are driving along a 30 mph residential road with cars parked on both sides. Ahead is a school with yellow zig-zag markings outside, and a school crossing patrol is standing at the kerb. An ice-cream van is not present, but a bus has stopped at a bus stop on your side of the road.',
    [
      ['vulnerable', 'What should you be most aware of as you pass the parked cars?', 'Children stepping out between the parked cars', ['Cars pulling out of driveways only', 'Cyclists behind you', 'Speed cameras'], 'Parked cars hide small children, who may run out without looking.', 'HC Rule 206'],
      ['rules', 'What do the yellow zig-zag markings outside the school mean?', 'You must not stop or park on them while they are in operation', ['You may park for 5 minutes', 'Only buses may stop', 'You must stop for children'], 'Keep the area clear so children can be seen and can see traffic.', 'HC Rule 238'],
      ['safety-margins', 'The road is wet. How should you adjust the gap to the car in front?', 'Leave at least double your normal gap', ['Keep the normal 2-second gap', 'Close up to stop others cutting in', 'Halve the gap because speeds are low'], 'Stopping distances are at least doubled on wet roads.', 'HC Rule 227'],
    ]),
  sc('motorway-night', 'Motorway at night',
    'You are driving on a three-lane motorway at night in light rain. The overhead gantries show a 50 mph limit in a red ring and a red X above the right-hand lane. After a while you begin to feel tired. Your exit is 20 miles away.',
    [
      ['motorway', 'What does the 50 in a red ring on the gantry mean?', 'It is a mandatory speed limit', ['It is an advisory speed', 'It applies to lorries only', 'It is the minimum speed'], 'Speed limits shown in a red ring are mandatory.', 'HC Rule 261'],
      ['motorway', 'What does the red X above the right-hand lane mean?', 'You must not use that lane', ['Lane for overtaking only', 'Lane for emergency vehicles only', 'The lane ends in 1 mile'], 'A red X means the lane is closed beyond the signal.', 'HC Rule 258'],
      ['alertness', 'You start to feel tired. What should you do?', 'Leave at the next exit or services and rest', ['Stop on the hard shoulder for a nap', 'Open the window and keep going', 'Speed up to reach your exit sooner'], 'Never stop on the hard shoulder to rest. Leave the motorway and take a break.', 'HC Rule 91'],
    ]),
  sc('country-lane', 'Country lane',
    'You are driving on a narrow, winding country road with a 60 mph national speed limit. There is no pavement. Ahead you can see two horse riders on your side of the road, and beyond them a sharp bend to the left. A tractor with a flashing amber beacon is coming the other way.',
    [
      ['vulnerable', 'How should you pass the horse riders?', 'Slowly, under 10 mph, leaving at least 2 metres', ['Quickly, to get past before the bend', 'Sounding your horn to alert them', 'Close to them so you do not hit the tractor'], 'Only pass when it is safe, and pass wide and slow.', 'HC Rule 215'],
      ['rules', 'Does the 60 mph limit mean 60 mph is a safe speed here?', 'No. You should drive at a speed that allows you to stop within the distance you can see to be clear', ['Yes, it is the legal limit', 'Yes, unless it is raining', 'No, you should drive at 50 mph exactly'], 'The speed limit is a maximum, not a target.', 'HC Rule 125'],
      ['other-vehicles', 'What does the flashing amber beacon on the tractor tell you?', 'It is a slow-moving vehicle', ['It is an emergency vehicle', 'It is about to turn', 'It has broken down'], 'Amber beacons warn of slow-moving vehicles.', 'HC Rule 225'],
    ]),
  sc('crash-scene', 'Arriving at a crash',
    'On a single carriageway road you come round a bend and find that a car and a motorcycle have collided a few minutes ago. The motorcyclist is lying in the road, conscious, still wearing their helmet. Nobody else has stopped yet.',
    [
      ['incidents', 'What should you do first?', 'Make the scene safe and warn other traffic, for example with hazard lights', ['Remove the motorcyclist\'s helmet', 'Move the motorcyclist to the verge', 'Take photos of the vehicles'], 'Danger comes first. Prevent further collisions.', 'HC Rule 283'],
      ['incidents', 'Should you remove the motorcyclist\'s helmet?', 'Only if it is essential', ['Yes, so they can breathe more easily', 'Yes, to check for head injuries', 'Yes, if they ask you to'], 'Removing it could cause serious spinal injury.', 'HC Rule 283'],
      ['incidents', 'The motorcyclist is bleeding from a leg wound. What should you do?', 'Apply firm pressure to the wound', ['Give them a drink of water', 'Remove their boots', 'Leave it until the ambulance arrives'], 'Firm pressure helps control bleeding.', 'HC Annex 7'],
    ]),
  sc('town-junction', 'Busy town junction',
    'You are approaching traffic lights in a busy town centre, intending to turn left. A cyclist is waiting in the advanced stop area ahead of you. Pedestrians are waiting to cross the road you are turning into. The lights change to green.',
    [
      ['vulnerable', 'What should you do about the cyclist when the lights change?', 'Let the cyclist move off first and do not cut across them', ['Turn left before the cyclist moves', 'Sound your horn', 'Overtake them on the junction'], 'Do not cut across cyclists going ahead when you are turning.', 'HC Rule H3'],
      ['vulnerable', 'Who has priority as you turn into the side road?', 'Pedestrians crossing or waiting to cross it', ['You do, because the lights are green', 'Whoever moves first', 'Vehicles behind you'], 'Give way to pedestrians crossing or waiting to cross the road you are turning into.', 'HC Rule H2'],
      ['signs', 'What colour comes after green at traffic lights?', 'Amber', ['Red and amber', 'Red', 'Flashing amber'], 'The sequence is red, red and amber, green, amber, red.', 'HC Rule 175'],
    ]),
  sc('caravan', 'Towing on holiday',
    'You are towing a loaded caravan along a dual carriageway in strong, gusty winds. The car is heavily loaded with luggage and a roof box. Suddenly the caravan begins to snake.',
    [
      ['loading', 'What should you do when the caravan starts to snake?', 'Ease off the accelerator and slow down gently', ['Brake hard', 'Accelerate to pull it straight', 'Steer sharply to correct it'], 'Reducing speed gradually lets the caravan settle.', 'HC Rule 98'],
      ['rules', 'What is the speed limit for a car towing a caravan on a dual carriageway?', '60 mph', ['50 mph', '70 mph', '40 mph'], 'Cars towing caravans or trailers: 60 mph on dual carriageways and motorways.', 'HC Rule 124'],
      ['loading', 'How does the roof box affect the car?', 'It increases wind resistance and fuel use', ['It improves stability', 'It reduces fuel use', 'It has no effect in wind'], 'Roof boxes increase drag and raise the centre of gravity, so side winds have more effect.', 'HC Rule 98'],
    ]),
];

export const scenarioQuestions = SCENARIOS.flatMap((s) => s.questions);
