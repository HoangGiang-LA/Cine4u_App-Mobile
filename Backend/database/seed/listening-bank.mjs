import {scenario} from './question-bank.mjs';
const listen = (topic, speech, ...items) => scenario('listening', `listening_${topic}`, speech,
  items.map(([prompt, correct, ...distractors]) => [prompt, correct, ...distractors, `Nội dung nghe: “${speech}” Vì vậy chọn “${correct}”.`]));

listen('daily_life', 'Hi Anna. Please meet me outside the library at half past three.',
  ['Where should Anna meet the speaker?', 'Outside the library', 'Inside a restaurant', 'At a bus station', 'At a hospital'],
  ['What time should they meet?', '3:30', '3:00', '2:30', '4:30']);
listen('daily_life', 'Could you buy some milk on your way home? We already have bread.',
  ['What should the listener buy?', 'Milk', 'Bread', 'Rice', 'Apples'],
  ['What do they already have?', 'Bread', 'Eggs', 'Coffee', 'Cheese']);
listen('daily_life', 'The washing machine is broken. The repair worker will come tomorrow morning.',
  ['What is broken?', 'The washing machine', 'The television', 'The cooker', 'The bicycle'],
  ['When will the worker come?', 'Tomorrow morning', 'Tonight', 'Next week', 'This afternoon']);
listen('daily_life', 'I left your keys on the kitchen table, next to the blue cup.',
  ['Where are the keys?', 'On the kitchen table', 'In the bedroom', 'Under the sofa', 'In the car'],
  ['What color is the cup?', 'Blue', 'Red', 'Yellow', 'Green']);
listen('daily_life', 'Our neighbors are moving on Sunday. We will help them carry boxes.',
  ['When are the neighbors moving?', 'Sunday', 'Monday', 'Wednesday', 'Friday'],
  ['How will the speakers help?', 'Carry boxes', 'Paint a school', 'Cook at a restaurant', 'Buy a car']);

listen('travel', 'Attention, passengers. The train to Da Nang will leave from platform four at ten fifteen.',
  ['Which platform should passengers use?', 'Platform four', 'Platform one', 'Platform two', 'Platform six'],
  ['When does the train leave?', '10:15', '10:50', '9:15', '11:30']);
listen('travel', 'Your room is number two hundred and six. Breakfast is served on the first floor.',
  ['What is the room number?', '206', '216', '260', '602'],
  ['Where is breakfast served?', 'On the first floor', 'On the roof', 'In the garden', 'On the fifth floor']);
listen('travel', 'Turn right at the traffic lights. The museum is opposite the bank.',
  ['Which way should the listener turn?', 'Right', 'Left', 'Back', 'Straight ahead without turning'],
  ['What is opposite the museum?', 'The bank', 'The school', 'The cinema', 'The hospital']);
listen('travel', 'I would like a return ticket to Oxford for Saturday, please.',
  ['What kind of ticket does the speaker want?', 'A return ticket', 'A one-way ticket', 'A concert ticket', 'A museum ticket'],
  ['When does the speaker want to travel?', 'Saturday', 'Tuesday', 'Thursday', 'Sunday']);
listen('travel', 'The boat tour lasts two hours. Please wear a life jacket during the trip.',
  ['How long is the tour?', 'Two hours', 'Thirty minutes', 'Four hours', 'One day'],
  ['What should passengers wear?', 'A life jacket', 'A winter coat', 'A school uniform', 'A climbing helmet']);

listen('work', 'The team meeting has moved to Tuesday at nine. We will use room twelve.',
  ['What is the new meeting day?', 'Tuesday', 'Monday', 'Wednesday', 'Friday'],
  ['Which room will the team use?', 'Room twelve', 'Room two', 'Room nine', 'Room twenty']);
listen('work', 'Please email the report to Ms. Green before five this afternoon.',
  ['How should the report be sent?', 'By email', 'By post', 'By fax', 'By text message'],
  ['What is the deadline?', 'Before 5 p.m. today', 'Tomorrow morning', 'Next Friday', 'Before noon tomorrow']);
listen('work', 'Your interview is on the third floor. Ask for Mr. Lee at reception.',
  ['Where is the interview?', 'On the third floor', 'On the ground floor', 'On the fifth floor', 'In the basement'],
  ['Who should the applicant ask for?', 'Mr. Lee', 'Ms. Green', 'Mr. Brown', 'Ms. White']);
listen('work', 'The printer has run out of paper. There is another packet in the cupboard.',
  ['What does the printer need?', 'Paper', 'A new screen', 'A mouse', 'A battery'],
  ['Where is the extra packet?', 'In the cupboard', 'Under a chair', 'In the car park', 'On the roof']);
listen('work', 'I am taking Friday off. Alex will answer customer calls while I am away.',
  ['When is the speaker taking time off?', 'Friday', 'Monday', 'Tuesday', 'Thursday'],
  ['What will Alex do?', 'Answer customer calls', 'Repair a car', 'Teach a class', 'Clean the windows']);

listen('education', 'For tomorrow’s lesson, please read pages twenty to twenty-five and bring a dictionary.',
  ['Which pages should students read?', '20 to 25', '2 to 5', '25 to 30', '30 to 35'],
  ['What should students bring?', 'A dictionary', 'A guitar', 'A ruler only', 'A lunch box only']);
listen('education', 'The speaking test will start at two o’clock. Each pair will have five minutes.',
  ['When does the speaking test start?', '2:00', '1:00', '3:00', '5:00'],
  ['How long does each pair have?', 'Five minutes', 'Two minutes', 'Ten minutes', 'Twenty minutes']);
listen('education', 'The computer room is closed today. Please use the library computers instead.',
  ['Which room is closed?', 'The computer room', 'The music room', 'The science laboratory', 'The gym'],
  ['Where should students use computers?', 'In the library', 'In the café', 'In the playground', 'In the staff kitchen']);
listen('education', 'Our science project is about recycling. Bring an empty plastic bottle on Thursday.',
  ['What is the project about?', 'Recycling', 'Astronomy', 'Cooking', 'Ancient history'],
  ['What should students bring?', 'An empty plastic bottle', 'A glass mirror', 'A bag of rice', 'A new textbook']);
listen('education', 'The school bus leaves at seven twenty. Be at the main gate ten minutes earlier.',
  ['When does the bus leave?', '7:20', '7:10', '7:30', '8:20'],
  ['When should students be at the gate?', '7:10', '7:20', '7:30', '8:10']);

listen('food', 'I would like a bowl of vegetable soup and a glass of orange juice, please.',
  ['What food does the speaker order?', 'Vegetable soup', 'Fried rice', 'A cheese sandwich', 'Chicken noodles'],
  ['What drink does the speaker order?', 'Orange juice', 'Apple juice', 'Milk', 'Coffee']);
listen('food', 'Bake the bread for twenty minutes. Let it cool before you cut it.',
  ['How long should the bread bake?', 'Twenty minutes', 'Ten minutes', 'Thirty minutes', 'One hour'],
  ['What should happen before cutting?', 'The bread should cool', 'The bread should be boiled', 'The bread should be frozen', 'The bread should be washed']);
listen('food', 'This dish contains peanuts. If you have a peanut allergy, choose the tomato pasta instead.',
  ['What does the dish contain?', 'Peanuts', 'Only rice', 'Only apples', 'Only potatoes'],
  ['Which alternative is suggested?', 'Tomato pasta', 'Peanut cake', 'Cheese soup', 'Fried fish']);
listen('food', 'We have a table for four by the window. Your waiter will come in a moment.',
  ['How many people is the table for?', 'Four', 'Two', 'Six', 'Eight'],
  ['Where is the table?', 'By the window', 'In the kitchen', 'Outside the entrance', 'On the roof']);
listen('food', 'Please slice two onions and wash the carrots. I will prepare the rice.',
  ['How many onions are needed?', 'Two', 'One', 'Three', 'Five'],
  ['What will the speaker prepare?', 'The rice', 'The carrots', 'A cake', 'The drinks']);

listen('health', 'Your appointment with the dentist is at eleven on Monday. Please arrive a little early.',
  ['Who is the appointment with?', 'The dentist', 'A driving instructor', 'A music teacher', 'A shop manager'],
  ['When is the appointment?', 'Monday at eleven', 'Monday at nine', 'Tuesday at eleven', 'Friday at ten']);
listen('health', 'The first-aid box is beside the office door. There are bandages inside.',
  ['Where is the first-aid box?', 'Beside the office door', 'Under the stairs', 'On the roof', 'In a car'],
  ['What is inside the box?', 'Bandages', 'Notebooks', 'Cooking oil', 'Toy cars']);
listen('health', 'The walking group meets in the park at six every morning. New members are welcome.',
  ['Where does the group meet?', 'In the park', 'At the airport', 'At a cinema', 'In a bank'],
  ['When does the group meet?', '6 a.m.', '6 p.m.', 'Noon', 'Midnight']);
listen('health', 'I cannot join the football game today because my ankle hurts. I will watch from the seats.',
  ['Why can’t the speaker play?', 'Their ankle hurts', 'They lost their ticket', 'They have a meeting', 'It is snowing'],
  ['What will the speaker do?', 'Watch the game', 'Go swimming', 'Join a race', 'Cook dinner']);
listen('health', 'The clinic has changed my appointment from Wednesday to Thursday. It is still at three in the afternoon.',
  ['What is the new appointment day?', 'Thursday', 'Wednesday', 'Monday', 'Saturday'],
  ['What time is the appointment?', '3 p.m.', '3 a.m.', '2 p.m.', '5 p.m.']);
