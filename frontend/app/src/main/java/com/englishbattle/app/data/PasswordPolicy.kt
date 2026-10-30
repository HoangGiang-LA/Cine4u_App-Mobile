package com.englishbattle.app.data

/** Matches the project's Firebase Authentication policy for newly set passwords. */
object PasswordPolicy {
    const val MESSAGE = "Mật khẩu phải ít nhất 8 kí tự, bao gồm số, chữ hoa và ký tự đặc biệt."
    // Firebase's allowedNonAlphanumericCharacters; whitespace and emoji do not count.
    private const val SPECIAL_CHARACTERS = "^\$*.[]{}()?\"!@#%&/\\,><':;|_~`-"

    fun isValid(password: String): Boolean = password.length >= 8 &&
        password.any { it in '0'..'9' } && password.any { it in 'A'..'Z' } &&
        password.any { it in SPECIAL_CHARACTERS }
}
