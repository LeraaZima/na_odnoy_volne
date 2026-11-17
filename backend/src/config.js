export function parseRoomLimit(value = '10') {
  if (!/^(?:[2-9]|10)$/.test(String(value))) throw new Error('ROOM_MAX_PARTICIPANTS должен быть целым числом от 2 до 10');
  return Number(value);
}
export const roomLimit = parseRoomLimit(process.env.ROOM_MAX_PARTICIPANTS);
