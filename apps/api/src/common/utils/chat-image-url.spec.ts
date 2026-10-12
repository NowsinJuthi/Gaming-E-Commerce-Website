import { isValidChatImageUrl } from './chat-image-url';

const roomId = '507f1f77bcf86cd799439011';

describe('isValidChatImageUrl', () => {
  it('accepts same-origin upload paths for the room', () => {
    expect(
      isValidChatImageUrl(`/api/uploads/live-chat/${roomId}/chat.webp`, roomId),
    ).toBe(true);
  });

  it('rejects substring decoys on third-party hosts', () => {
    expect(
      isValidChatImageUrl(
        `https://evil.test/?x=/uploads/live-chat/${roomId}/x`,
        roomId,
      ),
    ).toBe(false);
  });

  it('rejects a different room id', () => {
    expect(
      isValidChatImageUrl(
        '/api/uploads/live-chat/507f1f77bcf86cd799439099/chat.webp',
        roomId,
      ),
    ).toBe(false);
  });

  it('rejects protocol-relative and traversal paths', () => {
    expect(isValidChatImageUrl(`//evil.test/uploads/live-chat/${roomId}/x`, roomId)).toBe(
      false,
    );
    expect(
      isValidChatImageUrl(`/api/uploads/live-chat/${roomId}/../secret`, roomId),
    ).toBe(false);
  });
});
