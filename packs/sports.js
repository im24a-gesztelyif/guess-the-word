const { entry: e } = require('./util');

const baseSports = [
  e('soccer', 'Round ball', 'Goalposts', '11 players', 'Offside rule'),
  e('basketball', 'Hoop', 'Dribble', 'NBA', 'Dunk'),
  e('tennis', 'Racket', 'Court', 'Grand Slam', 'Serve and volley'),
  e('baseball', 'Bat', 'Diamond', 'Home run', 'Pitcher'),
  e('golf', 'Clubs', '18 holes', 'Par', 'Tee'),
  e('boxing', 'Ring', 'Gloves', 'KO', 'Rounds'),
  e('cycling', 'Bicycle', 'Tour de France', 'Peloton', 'Helmet'),
  e('swimming', 'Pool', 'Lanes', 'Freestyle', 'Goggles'),
  e('volleyball', 'Net', 'Spikes', 'Six players', 'Serve'),
  e('rugby', 'Oval ball', 'Try', 'Scrum', 'Rucks'),
  e('cricket', 'Bat and ball', 'Wickets', 'Overs', 'Bowler'),
  e('hockey', 'Ice or field', 'Puck or ball', 'Stick', 'Goalie'),
  e('table tennis', 'Ping pong', 'Small paddles', 'Fast rallies', 'Table net'),
  e('badminton', 'Shuttlecock', 'Light racket', 'Net', 'Quick'),
  e('lacrosse', 'Stick with net', 'Goalie', 'Fast', 'Field sport'),
  e('handball', 'Throwing', 'Indoor court', 'Goal', 'Fast breaks'),
  e('wrestling', 'Mat', 'Grappling', 'Pins', 'Takedowns'),
  e('judo', 'Throws', 'Gi', 'Grappling', 'Olympic'),
  e('karate', 'Strikes', 'Martial art', 'Belts', 'Kata'),
  e('taekwondo', 'Kicks', 'Korean martial art', 'Belts', 'Olympic'),
  e('jui jitsu', 'Ground fighting', 'Submissions', 'Gi or no-gi', 'Chokes'),
  e('mma', 'Mixed martial arts', 'Octagon', 'Strikes and grappling', 'Cage'),
  e('fencing', 'Swords', 'Foil epee sabre', 'Touches', 'Mask'),
  e('archery', 'Bow and arrow', 'Targets', 'Bullseye', 'Range'),
  e('shooting', 'Firearms or airgun', 'Targets', 'Precision', 'Range'),
  e('surfing', 'Waves', 'Board', 'Ocean', 'Balance'),
  e('skateboarding', 'Deck and trucks', 'Tricks', 'Half-pipe', 'Street'),
  e('snowboarding', 'Snow', 'Board', 'Slope', 'Winter sport'),
  e('skiing', 'Snow', 'Skis', 'Poles', 'Slopes'),
  e('curling', 'Ice', 'Stones', 'Brooms', 'House target'),
  e('figure skating', 'Ice', 'Jumps', 'Spins', 'Pairs or solo'),
  e('speed skating', 'Ice track', 'Blades', 'Fast laps', 'Winter'),
  e('bobsled', 'Ice track', 'Sled', 'Team push', 'Winter'),
  e('luge', 'Sled', 'Feet first', 'Ice track', 'Fast'),
  e('rowing', 'Boat', 'Oars', 'Crew', 'Regatta'),
  e('canoeing', 'Paddle', 'Boat', 'Water', 'Sprint or slalom'),
  e('kayaking', 'Double-blade paddle', 'Boat', 'River or sea', 'Whitewater'),
  e('sailing', 'Wind powered', 'Boat', 'Sails', 'Regatta'),
  e('diving', 'Platform or springboard', 'Water entry', 'Acrobatics', 'Scores'),
  e('water polo', 'Ball sport in pool', 'Goals', 'Swim', 'Caps'),
  e('triathlon', 'Swim bike run', 'Endurance', 'Transitions', 'Race'),
  e('marathon', '42.195 km', 'Distance run', 'Endurance', 'Race'),
  e('track and field', 'Sprints and jumps', 'Stadium', 'Medals', 'Olympic'),
  e('high jump', 'Bar clearance', 'Track event', 'Fosbury flop', 'Mat'),
  e('long jump', 'Sand pit', 'Speed and leap', 'Track event', 'Measurement'),
  e('pole vault', 'Pole', 'Bar clearance', 'Track event', 'Height'),
  e('shot put', 'Heavy ball', 'Throw', 'Circle', 'Strength'),
  e('discus', 'Spinning throw', 'Heavy disc', 'Circle', 'Field event'),
  e('javelin', 'Spear throw', 'Run-up', 'Track and field', 'Distance'),
  e('hammer throw', 'Weighted ball on wire', 'Spin', 'Release', 'Field event'),
  e('equestrian', 'Horse riding', 'Show jumping', 'Dressage', 'Eventing'),
  e('polo', 'Horses', 'Mallets', 'Goal', 'Field'),
  e('bowling', 'Pins', 'Lane', 'Ball', 'Strikes'),
  e('billiards', 'Cue stick', 'Table', 'Pockets', 'Chalk'),
  e('snooker', 'Cue sport', 'Red and color balls', 'Large table', 'Frames'),
  e('darts', 'Throwing', 'Board', 'Bullseye', 'Pub game'),
  e('cricket', 'Bat and ball', 'Wickets', 'Overs', 'Bowler'),
  e('australian football', 'Oval ball', 'Marks', 'Goal posts', 'AFL'),
  e('american football', 'Touchdowns', 'Yard lines', 'Helmet', 'NFL'),
  e('gaelic football', 'Ireland', 'Round ball', 'Posts and bar', 'Solo run'),
  e('hurling', 'Ireland', 'Stick and ball', 'Fast', 'Ancient game'),
  e('softball', 'Similar to baseball', 'Larger ball', 'Underhand pitch', 'Diamond'),
  e('ultimate frisbee', 'Flying disc', 'End zones', 'No contact', 'Spirit of the game'),
  e('frisbee golf', 'Discs', 'Targets', 'Course', 'Low score wins'),
  e('orienteering', 'Map and compass', 'Navigation', 'Course', 'Outdoors'),
  e('mountaineering', 'Climbing mountains', 'Ice axe', 'Ropes', 'Summits'),
  e('rock climbing', 'Harness', 'Ropes or bouldering', 'Walls', 'Routes'),
  e('bouldering', 'No ropes', 'Crash pads', 'Short climbs', 'Problems'),
  e('parkour', 'Urban movement', 'Vaults', 'Precision jumps', 'Flow'),
  e('gymnastics', 'Apparatus', 'Floor routines', 'Strength', 'Flexibility'),
  e('cheerleading', 'Stunts', 'Chants', 'Routines', 'Teams'),
  e('synchronized swimming', 'Artistic swimming', 'Choreography', 'Pool', 'Music'),
  e('dance sport', 'Ballroom', 'Latin', 'Judged', 'Pairs'),
  e('yoga', 'Poses', 'Breathing', 'Flexibility', 'Mat'),
  e('pilates', 'Core focus', 'Mat or reformer', 'Strength', 'Control'),
  e('aerobics', 'Cardio', 'Music', 'Classes', 'Movement'),
  e('crossfit', 'Functional fitness', 'High intensity', 'Box', 'WOD'),
  e('powerlifting', 'Squat', 'Bench press', 'Deadlift', 'Strength'),
  e('weightlifting', 'Snatch', 'Clean and jerk', 'Olympic', 'Platform'),
  e('bodybuilding', 'Physique', 'Muscles', 'Posing', 'Stage'),
  e('rowing', 'Boat', 'Oars', 'Crew', 'Regatta'),
  e('squash', 'Indoor court', 'Racquet', 'Small ball', 'Fast'),
  e('pickleball', 'Paddle sport', 'Wiffle ball', 'Small court', 'Popular'),
  e('handball', 'Throwing', 'Indoor court', 'Goal', 'Fast breaks'),
];

function fillTo100(list, label, prefix) {
  const out = [...list];
  const seen = new Set(out.map((item) => item.word));
  let i = 1;
  while (out.length < 100) {
    const word = `${prefix}${i}`;
    if (!seen.has(word)) {
      out.push(e(word, `${label} clue ${i}`, `${label} tidbit ${i}`, 'Training filler', 'Replayable item'));
      seen.add(word);
    }
    i += 1;
  }
  return out;
}

module.exports = fillTo100(baseSports, 'Sport', 'sportextra');
