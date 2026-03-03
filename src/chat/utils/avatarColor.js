const colors = [
  "#2196F3",
  "#32c787",
  "#00BCD4",
  "#ff5652",
  "#ffc107",
  "#ff85af",
  "#FF9800",
  "#39bbb0"
];

export function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = 31 * hash + name.charCodeAt(i);
  }
  return colors[Math.abs(hash % colors.length)];
}
