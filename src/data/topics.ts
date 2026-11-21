import type { Topic } from './types';

// The 14 topic areas used by DVSA for the car theory test.
// mockWeight values sum to 47; the remaining 3 questions come from a scenario.
export const TOPICS: Topic[] = [
  {
    id: 'alertness', name: 'Alertness', short: 'Alert', mockWeight: 3,
    lesson: [
      { heading: 'Observation', points: [
        'Use the mirrors well before you signal or change speed or direction: Mirrors – Signal – Manoeuvre (Rules 159–161).',
        'Mirrors leave blind spots. Look over your shoulder before moving off and before changing lanes where needed.',
        'Windscreen pillars can hide pedestrians, cyclists and motorcyclists, especially at junctions and roundabouts. Move your head to look around them.',
      ]},
      { heading: 'Distractions', points: [
        'You MUST NOT use a hand-held phone or similar device while driving, including when stopped in traffic or at lights (Rule 149).',
        'Hands-free devices are still distracting. Find a safe place to stop before making or taking calls.',
        'Set up your sat nav before you start. Only glance at it when it is safe (Rule 150).',
        'Do not eat, drink, smoke, adjust music or do anything else that takes your attention off the road (Rule 148).',
      ]},
      { heading: 'Tiredness', points: [
        'Plan a break of at least 15 minutes after every 2 hours of driving (Rule 91).',
        'If you feel sleepy, stop somewhere safe and legal, then have caffeine and a short nap. Do not stop on a motorway hard shoulder.',
        'Opening a window for fresh air only helps for a short time.',
      ]},
    ],
  },
  {
    id: 'attitude', name: 'Attitude', short: 'Attitude', mockWeight: 3,
    lesson: [
      { heading: 'Being considerate', points: [
        'Be patient with other road users, including learners, older drivers and cyclists. Do not respond to aggressive driving.',
        'Never tailgate. Keep at least a 2-second gap in good conditions (Rule 126).',
        'If someone overtakes you, keep a steady course and speed. Slow down to let them back in if needed (Rule 168).',
        'Flash your headlights only to let others know you are there. Do not use them to give priority or to show annoyance (Rule 110).',
      ]},
      { heading: 'Horn and priority', points: [
        'Use the horn only to warn others you are there when your vehicle is moving. Never use it aggressively (Rule 112).',
        'You MUST NOT use the horn while stationary, or in a built-up area between 11.30 pm and 7.00 am, except when another road user poses a danger.',
        'Make room for emergency vehicles using blue lights, but do not break the law or put others in danger to do so (Rule 219).',
        'Give way to buses pulling out from bus stops when it is safe to do so (Rule 223).',
      ]},
    ],
  },
  {
    id: 'safety-vehicle', name: 'Safety and your vehicle', short: 'Vehicle', mockWeight: 4,
    lesson: [
      { heading: 'Checks and defects', points: [
        'Car tyres MUST have at least 1.6 mm of tread across the central three-quarters of the tread width, all the way around (Annex 6).',
        'Check tyre pressures when the tyres are cold. Wrong pressures affect braking, steering and fuel use.',
        'If the car keeps bouncing after you go over a bump, the shock absorbers may be worn.',
        'A warning light that stays on (for example ABS, brakes or oil) needs investigating before you continue.',
        'Cars must pass an MOT when they are 3 years old and every year after that (4 years in Northern Ireland).',
      ]},
      { heading: 'Safety equipment and the environment', points: [
        'Adjust the head restraint so its rigid part is at least as high as your eyes or the top of your ears, and as close to your head as is comfortable.',
        'Catalytic converters reduce harmful exhaust gases.',
        'To drive more economically: plan ahead, change up gears early, avoid harsh braking and acceleration, check tyre pressures and remove an empty roof rack.',
        'Switch off the engine if you are stopped for some time. Unnecessary idling is an offence (Rule 123).',
        'Dispose of used engine oil at a local authority site or garage. Never pour it down a drain.',
      ]},
    ],
  },
  {
    id: 'safety-margins', name: 'Safety margins', short: 'Margins', mockWeight: 3,
    lesson: [
      { heading: 'Typical stopping distances (Rule 126)', points: [
        '20 mph: 12 m (6 m thinking + 6 m braking)',
        '30 mph: 23 m (9 + 14)',
        '40 mph: 36 m (12 + 24)',
        '50 mph: 53 m (15 + 38)',
        '60 mph: 73 m (18 + 55)',
        '70 mph: 96 m (21 + 75)',
      ]},
      { heading: 'Weather', points: [
        'Leave at least a 2-second gap on fast roads and in tunnels.',
        'In the wet, stopping distances are at least doubled, so leave a gap of at least 4 seconds (Rule 227).',
        'On ice, stopping distances can be up to ten times greater than on a dry road (Rule 230).',
        'If the steering feels light in heavy rain, you may be aquaplaning. Ease off the accelerator and slow down gradually.',
        'In snow, use the highest gear you can and move off gently, possibly in second gear, to avoid wheelspin.',
        'Use fog lights when visibility is seriously reduced, generally to under 100 m, and switch them off when it improves (Rule 236).',
      ]},
    ],
  },
  {
    id: 'hazard-awareness', name: 'Hazard awareness', short: 'Hazards', mockWeight: 4,
    lesson: [
      { heading: 'Anticipation', points: [
        'Scan the road far ahead and to the sides. Look for clues such as parked cars, junctions, brake lights and pedestrians near the kerb.',
        'A hazard is anything that might make you change speed or direction.',
        'Ice-cream vans, school entrances and buses at stops mean children may run into the road.',
        'Slow down early when you see a potential hazard. You then have time to react if it develops.',
      ]},
      { heading: 'Your fitness to drive', points: [
        'Alcohol reduces co-ordination, slows reactions and gives false confidence (Rule 95).',
        'The drink-drive limit in England and Wales is 80 mg per 100 ml of blood (35 µg per 100 ml of breath). In Scotland it is 50 mg (22 µg).',
        'Check medicine labels or ask a pharmacist. Some medicines cause drowsiness (Rule 96).',
        'You must be able to read a car number plate from 20 metres in good daylight, with glasses or contact lenses if you need them.',
      ]},
    ],
  },
  {
    id: 'vulnerable', name: 'Vulnerable road users', short: 'Vulnerable', mockWeight: 4,
    lesson: [
      { heading: 'Hierarchy of road users (Rules H1–H3)', points: [
        'People driving vehicles that can cause the greatest harm have the greatest responsibility to reduce the danger they pose to others.',
        'At a junction, give way to pedestrians crossing or waiting to cross a road you are turning into or out of (H2).',
        'Do not cut across cyclists, horse riders or horse-drawn vehicles going ahead when you are turning (H3).',
      ]},
      { heading: 'Giving space', points: [
        'Leave at least 1.5 m when overtaking cyclists at speeds up to 30 mph, and more at higher speeds (Rule 163).',
        'Pass horse riders at under 10 mph and allow at least 2 m of space (Rule 215).',
        'Give pedestrians walking in the road at least 2 m and pass at low speed.',
        'A white stick means a person is blind or partially sighted. A white stick with red bands means they are also deaf (Rule 207).',
        'Learner, older and inexperienced drivers may react more slowly. Be patient with them.',
        'Look out for motorcyclists and cyclists at junctions. They are easy to miss.',
      ]},
    ],
  },
  {
    id: 'other-vehicles', name: 'Other types of vehicle', short: 'Others', mockWeight: 3,
    lesson: [
      { heading: 'Large vehicles', points: [
        'Long vehicles may need to move out to the right before turning left. Stay well back (Rule 221).',
        'Stay well back from large vehicles so you can see past them and the driver can see you in their mirrors.',
        'In the wet, large vehicles throw up spray. Drop back further.',
        'Cyclists and motorcyclists can be blown off course by strong side winds, especially on exposed roads.',
      ]},
      { heading: 'Special vehicles', points: [
        'Flashing amber beacons mean a slow-moving vehicle, such as a gritter or a mobility scooter on a dual carriageway (Rule 225).',
        'A flashing green beacon may be a doctor on an emergency call.',
        'Trams cannot steer around you. Do not enter road space reserved for trams (Rule 300).',
        'Powered mobility vehicles can travel at up to 8 mph on the road (Rule 220).',
      ]},
    ],
  },
  {
    id: 'handling', name: 'Vehicle handling', short: 'Handling', mockWeight: 4,
    lesson: [
      { heading: 'Control', points: [
        'Coasting (driving with the clutch down or in neutral) reduces your control and engine braking (Rule 122).',
        'Use a lower gear on long downhill stretches so the engine helps braking and the brakes do not overheat (brake fade).',
        'With ABS, brake firmly and keep the pressure on in an emergency. You can still steer (Rule 119).',
        'Skids are mainly caused by the driver. If the back of the car skids to the right, steer to the right (Rule 119).',
        'After going through a flood, test your brakes gently (Rule 121).',
      ]},
      { heading: 'Roads and conditions', points: [
        'Traffic-calming features such as road humps tell you to keep your speed down.',
        'At night, dip your headlights when meeting other traffic or following closely, so you do not dazzle other road users (Rule 115).',
        'In fog, keep well back, use dipped headlights and do not hang on to the tail lights in front.',
        'When overtaking, make sure you can return to your side without cutting in (Rules 162–169).',
      ]},
    ],
  },
  {
    id: 'motorway', name: 'Motorway rules', short: 'Motorway', mockWeight: 4,
    lesson: [
      { heading: 'Joining and lane discipline', points: [
        'Prohibited on motorways: learner motorcyclists, pedestrians, cyclists, horse riders and slow vehicles. Learner car drivers may only use them with an approved driving instructor in a car with dual controls (Rule 253).',
        'On a slip road, give priority to traffic already on the motorway and match its speed (Rule 259).',
        'Keep to the left-hand lane unless you are overtaking (Rule 264).',
        'Do not overtake on the left, unless traffic is moving slowly in queues and the lane on your right is moving more slowly (Rule 268).',
        'The national speed limit for cars on motorways is 70 mph. Cars towing trailers or caravans are limited to 60 mph and may not use the right-hand lane of a motorway with three or more lanes.',
      ]},
      { heading: 'Signals and breakdowns', points: [
        'A red X above a lane means you MUST NOT use that lane (Rule 258).',
        'A speed limit shown in a red ring on a gantry is mandatory.',
        'Studs: red marks the left edge, amber the central reservation, white the lanes, and green slip roads and lay-bys (Rule 132).',
        'If you break down, stop on the hard shoulder or in an emergency area. Leave by the left-hand door and wait behind the barrier. Do not use a warning triangle on a motorway (Rule 275).',
        'Arrows on marker posts point to the nearest emergency telephone.',
      ]},
    ],
  },
  {
    id: 'rules', name: 'Rules of the road', short: 'Rules', mockWeight: 4,
    lesson: [
      { heading: 'Speed limits for cars (Rule 124)', points: [
        'Built-up areas (street lights): 30 mph unless signs show otherwise.',
        'Single carriageways: 60 mph. Dual carriageways and motorways: 70 mph.',
        'Towing a caravan or trailer: 50 mph on single carriageways, 60 mph on dual carriageways and motorways.',
      ]},
      { heading: 'Junctions, parking and crossings', points: [
        'Do not enter a yellow box junction unless your exit is clear. The exception is when you are turning right and only oncoming traffic or other right-turning vehicles are stopping you (Rule 174).',
        'Do not park within 10 m of a junction, except in an authorised parking space (Rule 243).',
        'At night, park facing the direction of traffic. On roads with a speed limit over 30 mph you MUST use parking lights (Rules 248–249).',
        'Zebra crossings: give way once someone has stepped onto the crossing. Pelican crossings: a flashing amber light means give way to pedestrians still crossing (Rules 195–196).',
        'Toucan crossings are shared by pedestrians and cyclists. Equestrian (Pegasus) crossings are for horse riders.',
        'Double white lines with a solid line on your side: do not cross or straddle it, except to pass a stationary vehicle or a cyclist, horse or road maintenance vehicle travelling at 10 mph or less (Rule 129).',
      ]},
    ],
  },
  {
    id: 'signs', name: 'Road and traffic signs', short: 'Signs', mockWeight: 5,
    lesson: [
      { heading: 'Shapes and colours', points: [
        'Circles give orders. A red ring prohibits something. A blue circle tells you what you must do.',
        'Triangles warn. Rectangles give information.',
        'STOP is the only octagonal sign. GIVE WAY is the only inverted triangle.',
        'Blue rectangles are motorway signs, green are primary routes, white are local routes and brown are tourist destinations.',
        'The national speed limit sign is a white circle with a black diagonal stripe.',
      ]},
      { heading: 'Signals and markings', points: [
        'The traffic light sequence is red, red and amber, green, amber, then red again (Rule 175).',
        'You may only go on a green filter arrow in the direction it shows.',
        'Flashing red lights at level crossings, swing bridges, fire stations and similar places mean you MUST stop.',
        'Yellow zigzag lines outside schools mean you must not stop or park there while they are in operation.',
        'White zigzag lines at crossings: no parking and no overtaking the leading vehicle.',
      ]},
    ],
  },
  {
    id: 'documents', name: 'Essential documents', short: 'Docs', mockWeight: 2,
    lesson: [
      { heading: 'What you need', points: [
        'You MUST have at least third-party insurance (Annex 3).',
        'A vehicle MUST be taxed unless it has a Statutory Off Road Notification (SORN).',
        'The V5C registration certificate (logbook) records the registered keeper. It is not proof of ownership.',
        'You MUST tell DVLA if you change your name or address.',
        'If you get 6 or more penalty points within 2 years of passing your test, your licence will be revoked (New Drivers Act).',
        'Learner drivers must be supervised by someone at least 21 years old who has held a full licence for that type of vehicle for at least 3 years.',
        'If the police ask, you may have to produce your documents at a police station within 7 days.',
      ]},
    ],
  },
  {
    id: 'incidents', name: 'Incidents, accidents and emergencies', short: 'Incidents', mockWeight: 3,
    lesson: [
      { heading: 'At the scene', points: [
        'Use hazard warning lights to warn traffic. Switch off engines and make sure nobody smokes (Rule 283).',
        'Do not move injured people unless they are in further danger. Do not remove a motorcyclist\'s helmet unless it is essential.',
        'First aid (Annex 7): Danger, Response, Airway, Breathing, then Compressions if needed. For an adult, compress the chest 5–6 cm at a rate of 100–120 per minute.',
        'Burns: cool with clean, cold water for at least 10 minutes. Do not remove anything sticking to the burn.',
        'Bleeding: apply firm pressure to the wound.',
        'If you are involved in a collision, stop. If you do not exchange details at the scene, report it to the police as soon as possible, and in any case within 24 hours (Rule 286).',
      ]},
      { heading: 'Breakdowns and tunnels', points: [
        'Place a warning triangle at least 45 m behind your vehicle on the same side, but never on a motorway (Rule 274).',
        'If your vehicle stalls on a level crossing, get everyone out and clear of the crossing, then phone the signal operator (Rule 299).',
        'If you break down in a tunnel, switch on your hazard lights, switch off the engine, leave the vehicle and go to an emergency point.',
      ]},
    ],
  },
  {
    id: 'loading', name: 'Vehicle loading', short: 'Loading', mockWeight: 1,
    lesson: [
      { heading: 'Loads and towing (Rule 98)', points: [
        'The driver is responsible for making sure the vehicle is not overloaded and that loads are secure.',
        'Heavy loads may need higher tyre pressures and headlight adjustment. Check the vehicle handbook.',
        'A roof rack or roof box increases wind resistance and fuel use and affects handling.',
        'Distribute weight evenly in a trailer, with heavy items over the axle(s). The trailer\'s nose weight should suit the towing vehicle.',
        'If a caravan or trailer starts to snake, ease off the accelerator and reduce speed gently. Do not brake harshly.',
        'A stabiliser makes towing safer but is not a substitute for careful loading.',
        'Children MUST use a suitable child restraint until they are 12 years old or 135 cm tall, whichever comes first. Never put a rear-facing child seat in front of an active airbag.',
      ]},
    ],
  },
];

export const topicById = Object.fromEntries(TOPICS.map((t) => [t.id, t])) as Record<Topic['id'], Topic>;
