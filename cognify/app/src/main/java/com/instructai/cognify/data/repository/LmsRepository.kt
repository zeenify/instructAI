package com.instructai.cognify.data.repository

import com.instructai.cognify.data.local.dao.ClassDao
import com.instructai.cognify.data.local.dao.CourseDao
import com.instructai.cognify.data.local.dao.LessonDao
import com.instructai.cognify.data.local.dao.ModuleDao
import com.instructai.cognify.data.local.dao.QuestionDao
import com.instructai.cognify.data.local.dao.QuizDao
import com.instructai.cognify.data.local.entity.ClassEntity
import com.instructai.cognify.data.local.entity.CourseEntity
import com.instructai.cognify.data.local.entity.LessonEntity
import com.instructai.cognify.data.local.entity.ModuleEntity
import com.instructai.cognify.data.local.entity.QuestionEntity
import com.instructai.cognify.data.local.entity.QuizEntity
import com.instructai.cognify.data.logging.AppLogger
import com.instructai.cognify.data.remote.ApiService
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LmsRepository @Inject constructor(
    private val apiService: ApiService,
    private val classDao: ClassDao,
    private val courseDao: CourseDao,
    private val moduleDao: ModuleDao,
    private val lessonDao: LessonDao,
    private val quizDao: QuizDao,
    private val questionDao: QuestionDao,
    private val logger: AppLogger,
) {
    fun getCachedClasses(): Flow<List<ClassEntity>> = classDao.getAllClasses()

    fun getCachedCourses(classId: Long): Flow<List<CourseEntity>> =
        courseDao.getCoursesByClass(classId)

    fun getCachedModules(courseId: Long): Flow<List<ModuleEntity>> =
        moduleDao.getModulesByCourse(courseId)

    fun getCachedLessons(moduleId: Long): Flow<List<LessonEntity>> =
        lessonDao.getLessonsByModule(moduleId)

    fun getCachedQuizzes(moduleId: Long): Flow<List<QuizEntity>> =
        quizDao.getQuizzesByModule(moduleId)

    suspend fun syncAll(): Result<Unit> = runCatching {
        val classesResponse = apiService.getClasses()
        if (!classesResponse.isSuccessful) {
            logger.log("LmsRepository", "syncAll: getClasses returned ${classesResponse.code()}")
            return@runCatching
        }

        val classDtos = classesResponse.body() ?: run {
            logger.log("LmsRepository", "syncAll: getClasses body was null")
            return@runCatching
        }
        val classEntities = classDtos.map { dto ->
            ClassEntity(
                id = dto.id,
                name = dto.name,
                teacherName = dto.teacher?.teacherProfile?.let { "${it.firstName} ${it.lastName}" } ?: "",
                coursesCount = dto.coursesCount,
                progressPercent = dto.progressPercent,
            )
        }
        classDao.deleteAll()
        classDao.insertAll(classEntities)

        classDtos.forEach { classDto ->
            val detailResponse = apiService.getClassDetail(classDto.id)
            if (detailResponse.isSuccessful) {
                val detail = detailResponse.body() ?: return@forEach
                val courseEntities = detail.courses.map { c ->
                    CourseEntity(
                        id = c.id,
                        classId = c.classId,
                        title = c.title,
                        description = c.description,
                        isPublished = c.isPublished,
                        isCoding = c.isCoding,
                        orderIndex = c.orderIndex,
                        progressPercent = c.progressPercent,
                    )
                }
                courseDao.deleteByClass(classDto.id)
                courseDao.insertAll(courseEntities)
            } else {
                logger.log("LmsRepository", "syncAll: getClassDetail(${classDto.id}) returned ${detailResponse.code()}")
            }
        }
    }

    suspend fun syncCourseDetail(courseId: Long): Result<Unit> = runCatching {
        val response = apiService.getCourseDetail(courseId)
        if (!response.isSuccessful) {
            logger.log("LmsRepository", "syncCourseDetail($courseId): getCourseDetail returned ${response.code()}")
            return@runCatching
        }

        val data = response.body() ?: run {
            logger.log("LmsRepository", "syncCourseDetail($courseId): body was null")
            return@runCatching
        }
        val course = data.course

        val moduleEntities = course.modules.map { m ->
            ModuleEntity(
                id = m.id,
                courseId = m.courseId,
                title = m.title,
                orderIndex = m.orderIndex,
                isPublished = m.isPublished,
            )
        }
        moduleDao.deleteByCourse(courseId)
        moduleDao.insertAll(moduleEntities)

        course.modules.forEach { module ->
            val lessonEntities = module.lessons.map { l ->
                LessonEntity(
                    id = l.id,
                    moduleId = l.moduleId,
                    title = l.title,
                    content = Gson().toJson(l.content),
                    orderIndex = l.orderIndex,
                    isPublished = l.isPublished,
                    aiEnabled = l.aiEnabled,
                    isCompleted = l.id in data.completedLessons,
                )
            }
            lessonDao.deleteByModule(module.id)
            lessonDao.insertAll(lessonEntities)

            val quizEntities = module.quizzes.map { q ->
                QuizEntity(
                    id = q.id,
                    moduleId = q.moduleId,
                    title = q.title,
                    isRandomized = q.isRandomized,
                    timeLimitMinutes = q.timeLimitMinutes,
                    orderIndex = q.orderIndex,
                    passingScore = q.passingScore,
                    isPublished = q.isPublished,
                    timerMode = q.timerMode,
                    questionLimit = q.questionLimit,
                )
            }
            quizDao.deleteByModule(module.id)
            quizDao.insertAll(quizEntities)
        }
    }

    suspend fun syncLessonQuestions(quizId: Long): Result<List<QuestionEntity>> = runCatching {
        val response = apiService.getQuiz(quizId)
        if (!response.isSuccessful) {
            logger.log("LmsRepository", "syncLessonQuestions($quizId): getQuiz returned ${response.code()}")
            return@runCatching emptyList()
        }

        val data = response.body() ?: run {
            logger.log("LmsRepository", "syncLessonQuestions($quizId): body was null")
            return@runCatching emptyList()
        }
        val questions = data.quiz.questions.map { q ->
            QuestionEntity(
                id = q.id,
                quizId = q.quizId,
                questionText = q.questionText,
                type = q.type,
                options = Gson().toJson(q.options),
                points = q.points,
                boilerplate = q.boilerplate,
            )
        }
        questionDao.deleteByQuiz(quizId)
        questionDao.insertAll(questions)
        questions
    }
}
