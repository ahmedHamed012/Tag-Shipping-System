exports.attachAuthUser = (req, res, next) => {
  req.user = req.session?.user || null;
  res.locals.currentUser = req.user;
  next();
};

exports.requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.redirect("/auth/login");
  }
  return next();
};

exports.requireGuest = (req, res, next) => {
  if (req.session?.user) {
    return res.redirect("/dashboard");
  }
  return next();
};
