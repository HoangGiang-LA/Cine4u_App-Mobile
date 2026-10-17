package com.englishbattle.app.data

data class Question(val prompt: String, val options: List<String>, val correct: Int, val explanation: String)

object QuizData {
    val vocabulary = listOf(
        Question("What does 'reliable' mean?", listOf("Difficult to understand", "Dependable or trustworthy", "Quick to change", "Unusual or surprising"), 1, "Reliable nghĩa là đáng tin cậy."),
        Question("Choose the opposite of 'generous'.", listOf("Kind", "Friendly", "Selfish", "Happy"), 2, "Selfish (ích kỷ) trái nghĩa với generous (hào phóng)."),
        Question("A person who teaches is a ___.", listOf("teacher", "doctor", "driver", "farmer"), 0, "Teacher là giáo viên."),
        Question("What does 'journey' mean?", listOf("Bữa ăn", "Hành trình", "Ngôi nhà", "Công việc"), 1, "Journey nghĩa là hành trình hoặc chuyến đi."),
        Question("Choose a synonym of 'happy'.", listOf("Tired", "Angry", "Sad", "Glad"), 3, "Glad và happy đều diễn tả cảm giác vui vẻ.")
    )
    val grammar = listOf(
        Question("She ___ to school yesterday.", listOf("go", "went", "gone", "going"), 1, "'Went' là dạng quá khứ của 'go'. Yesterday là dấu hiệu của thì quá khứ đơn."),
        Question("He ___ reading a book now.", listOf("is", "are", "am", "be"), 0, "He đi với is trong thì hiện tại tiếp diễn."),
        Question("I have lived here ___ 2020.", listOf("for", "at", "since", "on"), 2, "Since được dùng với mốc thời gian."),
        Question("There isn't ___ milk left.", listOf("some", "any", "many", "a"), 1, "Any thường được dùng trong câu phủ định."),
        Question("This is ___ interesting book.", listOf("a", "the", "an", "any"), 2, "Dùng an trước âm nguyên âm trong interesting.")
    )
    val reading = listOf(
        Question("Linh walks to school every morning. Her school is near her house.\n\nHow does Linh go to school?", listOf("By bus", "By car", "On foot", "By train"), 2, "Walks to school nghĩa là đi bộ đến trường."),
        Question("Tom loves books. He visits the library every Saturday.\n\nWhen does Tom visit the library?", listOf("Monday", "Saturday", "Sunday", "Friday"), 1, "Đoạn văn nói 'every Saturday'."),
        Question("The weather was rainy, so we stayed at home.\n\nWhy did they stay home?", listOf("It was sunny", "They were tired", "It was raining", "They were hungry"), 2, "Rainy có nghĩa là trời mưa.")
    )
    val listening = listOf(
        Question("I would like a cup of tea, please.", listOf("A cup of coffee", "A cup of tea", "A glass of milk", "A bottle of water"), 1, "Người nói muốn một tách trà: a cup of tea."),
        Question("The train leaves at nine o'clock.", listOf("At seven", "At eight", "At nine", "At ten"), 2, "Nine o'clock là chín giờ."),
        Question("Turn left at the next street.", listOf("Turn right", "Go straight", "Stop here", "Turn left"), 3, "Turn left nghĩa là rẽ trái.")
    )
    fun questions(category: String): List<Question> {
        val source = when (category) { "Ngữ pháp" -> grammar; "Nghe" -> listening; "Đọc hiểu" -> reading; else -> vocabulary }
        return List(10) { source[it % source.size] }
    }
}
