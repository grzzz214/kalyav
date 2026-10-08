// Configuration dynamique : reprend app.json et, pour le déploiement GitHub Pages,
// sert l'app web sous le sous-chemin du dépôt (ex. /kalyav) via EXPO_BASE_URL.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
