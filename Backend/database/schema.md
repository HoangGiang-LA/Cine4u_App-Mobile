
# Firebase Realtime Database Structure

## BE 1: User & Learning
- users
- categories
- lessons
- questions
- questionAnswers
- practiceAttempts
- learningProgress
- dailyChallenges

## BE 2: Battle & Realtime
- matchmakingQueue
- battleRooms
- battleSubmissions
- battleResults
- battleHistory
- leaderboards
- achievements
- userAchievements

## Shared
- notifications

## Security Requirements
1. Users can only modify their permitted profile fields.
2. Correct answers must not be readable by regular clients.
3. Battle scores and results are server-controlled.
4. Administrative operations require verified admin access.
5. Database rules must deny unauthorized access.
