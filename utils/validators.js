/**
 * Validate user data
 * @param {Object} user - User object to validate
 * @param {boolean} isUpdate - If this is an update operation
 * @returns {Object} - { isValid: boolean, errors: Array }
 */
function validateUser(user, isUpdate = false) {
  const errors = [];

  // Check required fields
  if (!user.fullName || user.fullName.trim().length < 3) {
    errors.push("الاسم الكامل: يجب أن يكون على الأقل 3 أحرف");
  }

  if (!user.email || !isValidEmail(user.email)) {
    errors.push("البريد الإلكتروني: يجب أن يكون صحيحاً");
  }

  if (!user.phone || !isValidPhone(user.phone)) {
    errors.push("رقم الهاتف: صيغة غير صحيحة");
  }

  if (!user.nationalId || user.nationalId.trim().length < 10) {
    errors.push("رقم الهوية الوطنية: صيغة غير صحيحة");
  }

  if (!isUpdate && (!user.password || user.password.length < 6)) {
    errors.push("الكلمة المرورية: يجب أن تكون على الأقل 6 أحرف");
  }

  if (
    user.role &&
    !["ADMIN", "CUSTOMER_SERVICE", "OPERATION"].includes(user.role)
  ) {
    errors.push("الدور: قيمة غير صحيحة");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (basic validation)
 */
function isValidPhone(phone) {
  const phoneRegex =
    /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
}

module.exports = {
  validateUser,
  isValidEmail,
  isValidPhone,
};
