import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../core/api/api-client.service';
import { MessageDto, SendMessageRequest } from '../models/messages.models';
import { PaginationQuery } from '../../../core/api/api.models';



@Injectable({ providedIn: 'root' })
export class MessagesApiService {
    private readonly apiClient = inject(ApiClientService);
    private readonly baseUrl = '/api/message';

    sendMessage(request: SendMessageRequest): Observable<MessageDto> {
        return this.apiClient.post<MessageDto, SendMessageRequest>(`${this.baseUrl}/send`, request);
    }

    getConversation(otherUserId: string, query?: PaginationQuery): Observable<MessageDto[]> {
        return this.apiClient.get<MessageDto[], PaginationQuery>(`${this.baseUrl}/conversation/${otherUserId}`, query);
    }

    getConversationsList(query?: PaginationQuery): Observable<MessageDto[]> {
        return this.apiClient.get<MessageDto[], PaginationQuery>(`${this.baseUrl}/conversations`, query);
    }

    getUnreadCount(): Observable<number> {
        return this.apiClient.get<number>(`${this.baseUrl}/unread/count`);
    }

    getUnreadCountInConversation(otherUserId: string): Observable<number> {
        return this.apiClient.get<number>(`${this.baseUrl}/unread/conversation/${otherUserId}/count`);
    }

    markAsRead(messageId: string): Observable<null> {
        return this.apiClient.patch<null, object>(`${this.baseUrl}/${messageId}/read`, {});
    }

    markConversationAsRead(otherUserId: string): Observable<null> {
        return this.apiClient.patch<null, object>(`${this.baseUrl}/conversation/${otherUserId}/read`, {});
    }

    deleteMessage(messageId: string): Observable<null> {
        return this.apiClient.delete<null>(`${this.baseUrl}/${messageId}`);
    }
}
