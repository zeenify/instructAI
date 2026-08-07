package com.instructai.cognify.ui.navigation

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.instructai.cognify.ui.common.CognifyBottomBar
import com.instructai.cognify.ui.home.HomeScreen
import com.instructai.cognify.ui.login.LoginScreen
import com.instructai.cognify.ui.reviews.ReviewsScreen
import com.instructai.cognify.ui.stats.StatsScreen

sealed class BottomNavItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    object Home : BottomNavItem(Routes.HOME, "Home", Icons.Filled.Home)
    object Reviews : BottomNavItem(Routes.REVIEWS, "Reviewers", Icons.Filled.Book)
    object Stats : BottomNavItem(Routes.STATS, "Stats", Icons.Filled.BarChart)
}

val bottomNavItems = listOf(
    BottomNavItem.Home,
    BottomNavItem.Reviews,
    BottomNavItem.Stats,
)

@Composable
fun CognifyNavGraph(
    deepLinkReviewId: Long? = null,
    onDeepLinkHandled: () -> Unit = {},
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    LaunchedEffect(deepLinkReviewId) {
        if (deepLinkReviewId != null) {
            navController.navigate(Routes.summary(deepLinkReviewId)) {
                launchSingleTop = true
            }
            onDeepLinkHandled()
        }
    }

    val showBottomBar = currentDestination?.route in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                CognifyBottomBar(
                    items = bottomNavItems,
                    currentDestination = currentDestination,
                    onItemClick = { item ->
                        navController.navigate(item.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.LOGIN,
            modifier = Modifier.padding(innerPadding),
            enterTransition = {
                fadeIn(animationSpec = tween(400)) + slideInHorizontally(animationSpec = tween(400)) { it / 4 }
            },
            exitTransition = {
                fadeOut(animationSpec = tween(300))
            },
            popEnterTransition = {
                fadeIn(animationSpec = tween(300))
            },
            popExitTransition = {
                fadeOut(animationSpec = tween(300)) + slideOutHorizontally(animationSpec = tween(300)) { it / 4 }
            },
        ) {
            composable(Routes.LOGIN) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Routes.HOME) {
                            popUpTo(Routes.LOGIN) { inclusive = true }
                        }
                    }
                )
            }

            composable(Routes.HOME) {
                HomeScreen(
                    onReviewClick = { id, title -> navController.navigate(Routes.reviewDetail(id, title)) },
                    onCreateReview = { navController.navigate(Routes.CREATE_REVIEW) },
                    onNavigateToSettings = { navController.navigate(Routes.SETTINGS) },
                )
            }

            composable(Routes.REVIEWS) {
                ReviewsScreen(
                    onReviewClick = { id, title -> navController.navigate(Routes.reviewDetail(id, title)) },
                    onCreateClick = { navController.navigate(Routes.CREATE_REVIEW) },
                )
            }

            composable(Routes.STATS) {
                StatsScreen()
            }

            composable(
                route = Routes.REVIEW_DETAIL,
                arguments = listOf(
                    navArgument("reviewId") { type = NavType.LongType },
                    navArgument("reviewTitle") { type = NavType.StringType; defaultValue = "" },
                ),
            ) { backStackEntry ->
                val reviewId = backStackEntry.arguments?.getLong("reviewId") ?: return@composable
                val reviewTitle = backStackEntry.arguments?.getString("reviewTitle") ?: ""
                com.instructai.cognify.ui.reviews.ReviewDetailScreen(
                    reviewId = reviewId,
                    reviewTitle = reviewTitle,
                    onBack = { navController.popBackStack() },
                    onNavigateToMode = { mode, id ->
                        when (mode) {
                            "flashcards" -> navController.navigate(Routes.flashcardDeck(id))
                            "cloze" -> navController.navigate(Routes.cloze(id))
                            "practice" -> navController.navigate(Routes.practiceTest(id))
                            "summary" -> navController.navigate(Routes.summary(id))
                        }
                    },
                )
            }

            composable(
                route = Routes.FLASHCARD_DECK,
                arguments = listOf(navArgument("reviewId") { type = NavType.LongType }),
            ) { backStackEntry ->
                val reviewId = backStackEntry.arguments?.getLong("reviewId") ?: return@composable
                com.instructai.cognify.ui.flashcards.FlashcardDeckScreen(
                    reviewId = reviewId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = Routes.CLOZE,
                arguments = listOf(navArgument("reviewId") { type = NavType.LongType }),
            ) { backStackEntry ->
                val reviewId = backStackEntry.arguments?.getLong("reviewId") ?: return@composable
                com.instructai.cognify.ui.cloze.ClozeScreen(
                    reviewId = reviewId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = Routes.PRACTICE_TEST,
                arguments = listOf(navArgument("reviewId") { type = NavType.LongType }),
            ) { backStackEntry ->
                val reviewId = backStackEntry.arguments?.getLong("reviewId") ?: return@composable
                com.instructai.cognify.ui.practice.PracticeTestScreen(
                    reviewId = reviewId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(
                route = Routes.SUMMARY,
                arguments = listOf(navArgument("reviewId") { type = NavType.LongType }),
            ) { backStackEntry ->
                val reviewId = backStackEntry.arguments?.getLong("reviewId") ?: return@composable
                com.instructai.cognify.ui.summary.SummaryScreen(
                    reviewId = reviewId,
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Routes.SETTINGS) {
                com.instructai.cognify.ui.settings.SettingsScreen(
                    onBack = { navController.popBackStack() },
                    onVoiceLab = { navController.navigate(Routes.VOICE_LAB) },
                    onLogout = {
                        navController.navigate(Routes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }

            composable(Routes.CREATE_REVIEW) {
                com.instructai.cognify.ui.reviews.CreateReviewScreen(
                    onBack = { navController.popBackStack() },
                    onCreated = { _ ->
                        navController.navigate(Routes.REVIEWS) {
                            popUpTo(Routes.HOME) { inclusive = false }
                            launchSingleTop = true
                        }
                    },
                )
            }

            composable(Routes.VOICE_LAB) {
                com.instructai.cognify.ui.voicelab.VoiceLabScreen(
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}
