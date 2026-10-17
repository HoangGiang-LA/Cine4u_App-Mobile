package com.englishbattle.app

import com.englishbattle.app.data.QuizData
import org.junit.Assert.*
import org.junit.Test

class QuizDataTest {
    @Test fun allSkillSessionsHaveTenValidQuestions() {
        listOf("Từ vựng", "Ngữ pháp", "Nghe", "Đọc hiểu").forEach { category ->
            val questions = QuizData.questions(category)
            assertEquals(10, questions.size)
            questions.forEach { q ->
                assertTrue(q.prompt.isNotBlank())
                assertEquals(4,q.options.distinct().size)
                assertTrue(q.correct in q.options.indices)
                assertTrue(q.explanation.isNotBlank())
            }
        }
    }
}
