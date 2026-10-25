import {scenario} from './question-bank.mjs';
const read = (topic, passage, ...items) => scenario('reading', `reading_${topic}`, passage,
  items.map(([prompt, correct, ...distractors]) => [prompt, correct, ...distractors, `Đáp án là “${correct}”, theo thông tin trong đoạn văn: ${passage}`]));

read('daily_life', 'Mai walks to school every morning. The walk takes fifteen minutes.',
  ['How does Mai get to school?', 'On foot', 'By bus', 'By bicycle', 'By train'],
  ['How long does the walk take?', '15 minutes', '5 minutes', '30 minutes', '1 hour']);
read('daily_life', 'Nam buys vegetables at the market on Saturday. He cooks dinner for his family afterward.',
  ['When does Nam visit the market?', 'Saturday', 'Monday', 'Tuesday', 'Friday'],
  ['What does Nam do afterward?', 'Cooks dinner', 'Goes swimming', 'Plays football', 'Watches a film']);
read('daily_life', 'Anna works from home on Wednesdays. She visits the office on all other weekdays.',
  ['Where does Anna work on Wednesdays?', 'At home', 'At a library', 'At a hospital', 'At a café'],
  ['Where does Anna work on Mondays?', 'At the office', 'At home', 'At a park', 'At a school']);
read('daily_life', 'The local shop opens at 8 a.m. and closes at 6 p.m. It is closed all day on Sunday.',
  ['What time does the shop open?', '8 a.m.', '6 a.m.', '8 p.m.', '6 p.m.'],
  ['On which day is the shop closed?', 'Sunday', 'Monday', 'Thursday', 'Saturday']);
read('daily_life', 'Lan keeps a small garden on her balcony. She waters the plants every evening.',
  ['Where is Lan’s garden?', 'On her balcony', 'In her kitchen', 'At school', 'Beside a river'],
  ['When does she water the plants?', 'Every evening', 'Every morning', 'Only on Sundays', 'Once a month']);

read('travel', 'Tom booked a train ticket to Hue. His train leaves at 7 a.m. on Friday.',
  ['Where is Tom going?', 'Hue', 'Hanoi', 'Da Lat', 'Can Tho'],
  ['How will Tom travel?', 'By train', 'By plane', 'By boat', 'By bicycle']);
read('travel', 'A regular museum ticket costs ten dollars. Children under six can enter for free.',
  ['How much is a regular ticket?', '10 dollars', '6 dollars', '16 dollars', '20 dollars'],
  ['Who can enter for free?', 'Children under six', 'All adults', 'Only teachers', 'All tourists']);
read('travel', 'Linh stayed at a hotel near the beach for three nights. She went swimming each morning.',
  ['How many nights did Linh stay?', 'Three', 'Two', 'Five', 'Seven'],
  ['What did Linh do each morning?', 'Went swimming', 'Went skiing', 'Visited a museum', 'Took a train']);
read('travel', 'A storm delayed our flight by two hours. We waited in the airport café.',
  ['Why was the flight delayed?', 'A storm', 'A festival', 'A lost ticket', 'Traffic on the road'],
  ['Where did the travelers wait?', 'The airport café', 'The beach', 'A bus stop', 'A hotel room']);
read('travel', 'Our guide asked us to meet at the hotel gate at nine. We then walked to the old town.',
  ['Where was the meeting point?', 'The hotel gate', 'The train station', 'The museum entrance', 'The beach'],
  ['Where did the group go next?', 'The old town', 'The airport', 'A mountain', 'A supermarket']);

read('science', 'A school installed solar panels on its roof. The panels supply electricity for classroom lights.',
  ['Where were the panels installed?', 'On the roof', 'Under the floor', 'In a pond', 'Inside desks'],
  ['What do the panels help power?', 'Classroom lights', 'Bicycles', 'Paper notebooks', 'School uniforms']);
read('science', 'Students built a small robot that sorts red and blue blocks. They tested it in the laboratory.',
  ['What does the robot sort?', 'Red and blue blocks', 'Library books', 'Flowers', 'Food orders'],
  ['Where was the robot tested?', 'In the laboratory', 'On a train', 'At the beach', 'In a shop']);
read('science', 'Minh saved his report before updating his computer. The update took twenty minutes.',
  ['What did Minh do before the update?', 'Saved his report', 'Deleted all files', 'Bought a computer', 'Printed a map'],
  ['How long did the update take?', '20 minutes', '2 minutes', '45 minutes', '2 hours']);
read('science', 'The science club placed one plant near a window and another in a dark cupboard. They compared the plants after one week.',
  ['Where was the first plant placed?', 'Near a window', 'In a freezer', 'Under water', 'Outside the school'],
  ['When did the club compare the plants?', 'After one week', 'After one hour', 'After one month', 'After one year']);
read('science', 'A weather app warned Hoa about heavy rain in the afternoon. She packed an umbrella before leaving home.',
  ['What did the app predict?', 'Heavy rain', 'Snow', 'Clear skies all day', 'A heatwave'],
  ['What did Hoa take?', 'An umbrella', 'A guitar', 'A football', 'A camera tripod']);

read('education', 'The library lends each student up to three books. Students must return them within two weeks.',
  ['How many books can a student borrow at most?', 'Three', 'One', 'Five', 'Ten'],
  ['When must the books be returned?', 'Within two weeks', 'Within one day', 'After six months', 'At the end of the year']);
read('education', 'Our English club meets every Thursday after school. Members practice speaking in pairs.',
  ['When does the club meet?', 'Thursday after school', 'Monday morning', 'Saturday night', 'Sunday afternoon'],
  ['How do members practice speaking?', 'In pairs', 'Only alone', 'In groups of twenty', 'Without any partner']);
read('education', 'Ms. Brown asked the class to submit a history project on Monday. Students could work in groups of four.',
  ['When is the project due?', 'Monday', 'Tuesday', 'Friday', 'Sunday'],
  ['How many students can be in a group?', 'Four', 'Two', 'Six', 'Eight']);
read('education', 'David studies new words for ten minutes before breakfast. He writes one example sentence for each word.',
  ['When does David study new words?', 'Before breakfast', 'During lunch', 'After dinner', 'At midnight'],
  ['What does he write for each word?', 'An example sentence', 'A song', 'A shopping list', 'A full novel']);
read('education', 'The school trip to the zoo was moved from Tuesday to Friday because of rain. Students should bring a packed lunch.',
  ['What is the new trip day?', 'Friday', 'Tuesday', 'Wednesday', 'Sunday'],
  ['What should students bring?', 'A packed lunch', 'A tent', 'A musical instrument', 'A paint bucket']);

read('culture', 'During the village festival, visitors watched a traditional dance. The performance began at sunset.',
  ['What did visitors watch?', 'A traditional dance', 'A football match', 'A science lesson', 'A cooking exam'],
  ['When did the performance begin?', 'At sunset', 'At sunrise', 'At noon', 'At midnight']);
read('culture', 'The community center offers a pottery class on Sundays. Participants make small bowls from clay.',
  ['What class does the center offer?', 'Pottery', 'Swimming', 'Photography', 'Programming'],
  ['What material do participants use?', 'Clay', 'Glass', 'Steel', 'Paper']);
read('culture', 'Local volunteers collected old books for children. They delivered the books to a rural school.',
  ['What did volunteers collect?', 'Old books', 'Shoes', 'Bicycles', 'Food containers'],
  ['Where were the books delivered?', 'A rural school', 'An airport', 'A shopping mall', 'A train station']);
read('culture', 'A street artist painted a mural of sea animals. The painting reminds residents to protect the ocean.',
  ['What does the mural show?', 'Sea animals', 'Mountain roads', 'Office buildings', 'Sports cars'],
  ['What is its message?', 'Protect the ocean', 'Drive faster', 'Build more car parks', 'Buy new phones']);
read('culture', 'The town holds a night market every Saturday. Visitors can buy handmade gifts and taste local food.',
  ['When is the night market held?', 'Every Saturday', 'Every Monday', 'Once a year', 'Every morning'],
  ['What can visitors buy?', 'Handmade gifts', 'Train engines', 'Airline tickets only', 'Office buildings']);

read('health', 'The clinic opens at seven in the morning. Patients with appointments should arrive ten minutes early.',
  ['When does the clinic open?', '7 a.m.', '10 a.m.', '7 p.m.', 'Noon'],
  ['How early should patients arrive?', '10 minutes', '1 minute', '1 hour', '2 hours']);
read('health', 'After sitting at her desk for an hour, Linh takes a short walking break. She walks around the office.',
  ['When does Linh take a break?', 'After an hour at her desk', 'After ten hours', 'Only on weekends', 'Before every phone call'],
  ['What does Linh do during her break?', 'Walks around the office', 'Drives to another city', 'Watches a film', 'Plays a full football match']);
read('health', 'The school health day includes a morning walk and a fruit tasting session. Parents are invited to join.',
  ['Which activity is included?', 'A morning walk', 'A midnight race', 'A mountain climb', 'A swimming competition'],
  ['Who is invited to join?', 'Parents', 'Only tourists', 'Only shop owners', 'Only bus drivers']);
read('health', 'Nam keeps a reusable water bottle in his school bag. He refills it during lunch.',
  ['Where does Nam keep the bottle?', 'In his school bag', 'In a cupboard at home', 'At the train station', 'In the freezer'],
  ['When does Nam refill it?', 'During lunch', 'At midnight', 'Only on Sunday', 'Before sunrise']);
read('health', 'Mai booked a dental checkup for next Wednesday. Her brother will take her to the clinic.',
  ['What appointment did Mai book?', 'A dental checkup', 'A driving lesson', 'A job interview', 'A music lesson'],
  ['Who will take Mai to the clinic?', 'Her brother', 'Her teacher', 'Her neighbor', 'Her cousin']);
