// Original starter content. This module is input to build-seed.mjs, not an upload file.
export const questions = [];

function vocabulary(topic, rows) {
  const entries = rows.trim().split('\n').map(line => line.trim().split('|'));
  entries.forEach(([term, meaning], i) => questions.push({
    categoryId: 'vocabulary', topicId: topic,
    prompt: `What does "${term}" mean in Vietnamese?`, correct: meaning,
    distractors: [1, 3, 6].map(offset => entries[(i + offset) % entries.length][1]),
    explanation: `“${term}” có nghĩa là “${meaning}”.`, difficulty: 'easy',
  }));
}

vocabulary('vocabulary_daily_life', `
neighbor|hàng xóm
laundry|quần áo cần giặt hoặc việc giặt giũ
appointment|cuộc hẹn
receipt|biên lai
household|hộ gia đình
tidy|gọn gàng
borrow|mượn
repair|sửa chữa
groceries|thực phẩm và đồ dùng mua cho gia đình
routine|thói quen hoặc công việc thường lệ
`);
vocabulary('vocabulary_travel', `
passport|hộ chiếu
luggage|hành lý
departure|sự khởi hành
arrival|sự đến nơi
itinerary|lịch trình chuyến đi
destination|điểm đến
boarding pass|thẻ lên máy bay
round-trip ticket|vé khứ hồi
accommodation|chỗ ở khi đi xa
sightseeing|việc tham quan
`);
vocabulary('vocabulary_work', `
colleague|đồng nghiệp
deadline|hạn chót
salary|tiền lương
interview|cuộc phỏng vấn
promotion|sự thăng chức
resign|từ chức hoặc xin nghỉ việc
employer|người sử dụng lao động
employee|nhân viên
meeting|cuộc họp
overtime|thời gian làm thêm giờ
`);
vocabulary('vocabulary_food', `
ingredient|nguyên liệu nấu ăn
recipe|công thức nấu ăn
appetizer|món khai vị
dessert|món tráng miệng
beverage|đồ uống
spicy|cay
boil|đun sôi
steam|hấp bằng hơi nước
peel|gọt vỏ
leftovers|thức ăn thừa sau bữa ăn
`);
vocabulary('vocabulary_study', `
assignment|bài tập được giao
scholarship|học bổng
tuition fee|học phí
semester|học kỳ
lecture|bài giảng
revise for an exam|ôn tập cho kỳ thi
graduate|tốt nghiệp
attendance|sự có mặt hoặc chuyên cần
textbook|sách giáo khoa
classmate|bạn cùng lớp
`);
vocabulary('vocabulary_health', `
symptom|triệu chứng
prescription|đơn thuốc
fever|cơn sốt
headache|cơn đau đầu
recover|hồi phục
bandage|băng dùng băng bó
checkup|buổi khám sức khỏe
allergy|tình trạng dị ứng
exercise|việc tập thể dục
balanced diet|chế độ ăn cân bằng
`);
vocabulary('vocabulary_idioms', `
break the ice|phá vỡ sự ngượng ngùng ban đầu
a piece of cake|việc rất dễ làm
under the weather|cảm thấy không khỏe
once in a blue moon|rất hiếm khi
spill the beans|tiết lộ bí mật
cost an arm and a leg|rất đắt đỏ
hit the books|bắt đầu học chăm chỉ
on the same page|có cùng cách hiểu
give someone a hand|giúp đỡ ai đó
better late than never|muộn còn hơn không bao giờ
`);

function grammar(topic, rows) {
  rows.trim().split('\n').forEach(line => {
    const [prompt, correct, a, b, c, explanation] = line.trim().split('|');
    questions.push({categoryId: 'grammar', topicId: topic, prompt, correct,
      distractors: [a, b, c], explanation, difficulty: 'easy'});
  });
}

grammar('grammar_tenses', `
She ___ to school yesterday.|went|go|gone|going|Yesterday chỉ thời gian quá khứ; quá khứ của go là went.
Look! The children ___ in the garden.|are playing|plays|played|has played|Look! cho biết hành động đang diễn ra; children dùng are playing.
My father ___ coffee every morning.|drinks|drink|drinking|are drinking|Every morning chỉ thói quen; chủ ngữ số ít dùng drinks.
I ___ my homework before my mother arrived yesterday.|had finished|have finished|finish|am finishing|Hành động hoàn tất trước một mốc quá khứ dùng had finished.
We ___ here since 2020.|have lived|live|are live|living|Since 2020 đi với hiện tại hoàn thành khi việc ở vẫn tiếp diễn.
At eight last night, I ___ dinner.|was cooking|cook|have cooked|am cook|Hành động đang diễn ra tại một thời điểm quá khứ dùng was cooking.
The train ___ at 7 a.m. every day.|leaves|leave|leaving|have left|Lịch trình thường xuyên dùng hiện tại đơn; the train là số ít.
She has already ___ the report.|written|wrote|write|writing|Sau has dùng quá khứ phân từ; write có dạng written.
They ___ at home last Sunday.|were|was|are being|has been|Last Sunday dùng quá khứ; chủ ngữ they đi với were.
Listen! Someone ___ at the door.|is knocking|knock|knocked|have knocked|Listen! báo hiệu hành động đang diễn ra; someone dùng is knocking.
`);
grammar('grammar_prepositions', `
The meeting starts ___ nine o'clock.|at|in|on|to|Dùng at trước giờ cụ thể.
My birthday is ___ July.|in|at|on|from|Dùng in trước tháng.
We have English lessons ___ Mondays.|on|at|in|by|Dùng on trước ngày trong tuần.
She has lived here ___ five years.|for|since|at|on|For đi với khoảng thời gian five years.
I have known him ___ 2022.|since|for|on|during|Since đi với mốc thời gian 2022.
The cat is hiding ___ the table, below its top.|under|above|over|onto|Under nghĩa là ở bên dưới.
She is interested ___ learning English.|in|on|at|for|Cụm đúng là interested in.
This book belongs ___ Mai.|to|with|at|from|Cụm belong to diễn tả sự sở hữu.
We usually travel to school ___ bus.|by|in|with|at|By bus là cụm thông dụng chỉ việc đi bằng xe buýt.
The picture is hanging ___ the wall.|on|in|under|between|Dùng on the wall khi vật được treo trên mặt tường.
`);
grammar('grammar_articles', `
Choose the indefinite article: She is ___ engineer.|an|a|the|no article|Engineer bắt đầu bằng âm nguyên âm nên dùng an.
Choose the indefinite article: He bought ___ new bicycle.|a|an|the|no article|New bắt đầu bằng âm phụ âm nên dùng a.
___ sun rises in the east.|The|A|An|Some|Sun là vật thể xác định duy nhất trong ngữ cảnh này nên dùng the.
It took me ___ hour to finish.|an|a|many|no article|Hour có h câm, bắt đầu bằng âm nguyên âm nên dùng an.
Choose the indefinite article: He studies at ___ university.|a|an|the|no article|University bắt đầu bằng âm /j/ nên dùng a.
I saw a dog. ___ dog was brown.|The|An|Some|These|Nhắc lại con chó đã được xác định nên dùng the.
Complete the usual expression for playing an instrument: She plays ___ piano.|the|an|many|some|Cách diễn đạt thông dụng là play the piano.
Choose the indefinite article: We need ___ umbrella.|an|a|the|no article|Umbrella bắt đầu bằng âm nguyên âm nên dùng an.
Choose the indefinite article: She is ___ honest person.|an|a|the|no article|Honest có h câm nên dùng an.
He is ___ best student in our class.|the|a|an|some|Trước tính từ so sánh nhất best dùng the.
`);
grammar('grammar_nouns', `
There are three ___ in the room.|children|child|childs|childes|Danh từ số nhiều của child là children.
Two ___ are waiting outside.|women|woman|womans|womanes|Danh từ số nhiều của woman là women.
Please put the books on those ___.|shelves|shelf|shelfs|shelfes|Danh từ số nhiều của shelf là shelves.
My grandfather has strong ___.|teeth|tooth|tooths|toothes|Danh từ số nhiều của tooth là teeth.
There are many ___ in the library.|books|book|bookes|a book|Many đi với danh từ đếm được số nhiều books.
How ___ water do you need?|much|many|a few|several|Water không đếm được trong ngữ cảnh này nên dùng how much.
How ___ apples are in the bag?|many|much|little|any much|Apples là danh từ đếm được số nhiều nên dùng how many.
I bought two ___ of bread.|loaves|loaf|loafs|loafes|Số nhiều của loaf là loaves.
The farmer keeps several ___.|sheep|sheeps|sheepes|a sheep|Sheep có dạng số ít và số nhiều giống nhau.
We need a ___ of scissors.|pair|piece|slice|bottle|Dùng a pair of scissors để chỉ một chiếc kéo.
`);
grammar('grammar_verbs', `
She enjoys ___ books.|reading|read|to reading|reads|Sau enjoy dùng động từ thêm ing.
They decided ___ early.|to leave|leaving|leave|left|Sau decide dùng to + động từ nguyên mẫu.
You must ___ a helmet.|wear|wearing|to wear|wore|Sau must dùng động từ nguyên mẫu không to.
He can ___ very well.|swim|swims|swimming|to swim|Sau can dùng động từ nguyên mẫu.
Let me ___ you.|help|to help|helping|helps|Let + tân ngữ + động từ nguyên mẫu không to.
She wants ___ a doctor.|to become|becoming|become|became|Want + to + động từ nguyên mẫu.
Please avoid ___ noise.|making|make|to make|made|Avoid đi với động từ thêm ing.
My parents made me ___ my room.|clean|to clean|cleaning|cleans|Make + tân ngữ + động từ nguyên mẫu trong câu chủ động.
We look forward to ___ you.|seeing|see|saw|to see|To trong look forward to là giới từ nên theo sau là seeing.
Would you mind ___ the window?|opening|open|to open|opened|Would you mind đi với động từ thêm ing.
`);
grammar('grammar_adjectives', `
This bag is ___ than that one.|heavier|heavy|heaviest|more heavier|So sánh hơn của heavy là heavier.
This is the ___ building in town.|tallest|taller|tall|most tallest|Sau the và trong cả nhóm dùng so sánh nhất tallest.
My new phone is ___ expensive than my old one.|more|most|muchest|many|So sánh hơn của expensive dùng more expensive.
The film was so ___ that I fell asleep.|boring|bored|bore|bores|Boring mô tả bộ phim gây nhàm chán.
I felt ___ after the long journey.|tired|tiring|tire|tires|Tired mô tả cảm giác mệt của người.
This exercise is as ___ as the previous one.|easy|easier|easiest|more easy|Cấu trúc as + tính từ nguyên dạng + as.
Today is ___ than yesterday.|colder|coldest|cold|more colder|So sánh hơn của cold là colder.
She is the ___ runner on our team.|fastest|faster|fast|more fast|So sánh nhất của fast là fastest.
This answer is ___ than the first one.|better|good|best|gooder|So sánh hơn bất quy tắc của good là better.
The weather is getting ___. It is worse than before.|worse|worst|badly|baddest|Getting worse diễn tả tình hình trở nên tệ hơn.
`);

// Reading and listening scenarios are appended below. Each has two questions.
export function scenario(categoryId, topicId, context, items) {
  items.forEach(([prompt, correct, a, b, c, explanation]) => questions.push({
    categoryId, topicId, prompt, correct, distractors: [a, b, c], explanation,
    difficulty: 'easy', ...(categoryId === 'reading' ? {passage: context} : {speechText: context}),
  }));
}
