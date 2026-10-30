export const logger = {
  info(event, fields = {}) { console.log(JSON.stringify({ level: 'info', event, ...fields })); },
  error(event, fields = {}) { console.error(JSON.stringify({ level: 'error', event, ...fields })); },
};
