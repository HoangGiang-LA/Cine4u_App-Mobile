package com.englishbattle.app

import com.englishbattle.app.data.PasswordPolicy
import org.junit.Assert.*
import org.junit.Test

class PasswordPolicyTest {
    @Test fun rejectsEachMissingRequirement() {
        listOf("", "Aa1234!", "abcdefgh1!", "Abcdefgh!", "Abcdefg1").forEach {
            assertFalse("Must reject a password missing a requirement", PasswordPolicy.isValid(it))
        }
    }

    @Test fun acceptsEightCharactersAndDoesNotRequireLowercase() {
        assertTrue(PasswordPolicy.isValid("Abcdef1!"))
        assertTrue(PasswordPolicy.isValid("ABCDEF1!"))
        assertTrue(PasswordPolicy.isValid("LongerPassword1@"))
    }

    @Test fun specialCharactersMatchFirebaseAndExcludeWhitespaceAndEmoji() {
        val firebaseSpecials = "^\$*.[]{}()?\"!@#%&/\\,><':;|_~`-"
        firebaseSpecials.forEach { assertTrue(PasswordPolicy.isValid("Abcdef1$it")) }
        listOf(" ", "\n", "\t", "🙂", "+", "=").forEach {
            assertFalse("Must use a Firebase-supported special character", PasswordPolicy.isValid("Abcdef1$it"))
        }
    }
}
