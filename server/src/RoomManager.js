import { Room } from './Room.js';
import { generateRoomCode } from './utils.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // code -> Room
  }

  createRoom(category) {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const room = new Room(this.io, code, { isPrivate: true, category });
    this.rooms.set(code, room);
    return room;
  }

  registerPublicRoom(room) {
    this.rooms.set(room.code, room);
  }

  getRoom(code) {
    if (!code) return undefined;
    return this.rooms.get(code.toString().toUpperCase());
  }

  deleteRoom(code) {
    const room = this.rooms.get(code);
    if (room) {
      room.destroy();
      this.rooms.delete(code);
    }
  }

  existingCodes() {
    return new Set(this.rooms.keys());
  }
}
