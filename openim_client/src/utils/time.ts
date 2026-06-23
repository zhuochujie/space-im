export const formatTime = (timestamp: number) => {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
};
