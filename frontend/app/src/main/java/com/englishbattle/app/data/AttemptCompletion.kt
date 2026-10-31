package com.englishbattle.app.data

// Learning APIs return "waiting" until getAttemptResult settles and saves the result.
internal suspend fun completeWaitingAttempt(
    attempt: AttemptState,
    loadResult: suspend (String) -> QuizResult
): AttemptState {
    if (attempt.mode == QuizMode.BATTLE || attempt.status != "waiting" || attempt.result != null) return attempt
    val result = loadResult(attempt.id)
    return attempt.copy(
        status = if (result.outcome == "abandoned") "abandoned" else "completed",
        result = result
    )
}
