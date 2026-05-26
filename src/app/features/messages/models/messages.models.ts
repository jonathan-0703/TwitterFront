export interface MessageDto {
    messageId: string;
    senderId: string;
    receiverId: string;
    senderUsername: string;
    receiverUsername: string;
    senderAvatar?: string;
    receiverAvatar?: string;
    content: string;
    isRead: boolean;
    createdAt: string;
}

export interface SendMessageRequest {
    receiverId: string;
    content: string;
}
