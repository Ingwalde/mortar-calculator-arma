// electron-vite: імпорт файлу з суфіксом ?asset повертає шлях до скопійованого ресурсу.
declare module "*?asset" {
  const path: string;
  export default path;
}
