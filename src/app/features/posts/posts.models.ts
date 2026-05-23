import { JsonRecord, PaginationQuery } from '../../core/api/api.models';

export interface PostDto extends JsonRecord {
  postId?: string;
  userId?: string;
  content?: string;
  isPublished?: boolean;
  createdAt?: string;
  userFullName?: string;
  userAvatar?: string | null;
  username?: string | null;
  repliedToPostId?: string | null;
  retweetOfPostId?: string | null;
  reportCount?: number;
  isFlagged?: boolean;
  deletedReason?: string | null;
  likesCount?: number;
  retweetsCount?: number;
  repliesCount?: number;
  mediaUrls?: string[] | null;
}

export interface PostListQuery extends PaginationQuery {
  userId?: string;
}

export interface SavePostRequest {
  userId?: string;
  content: string;
  isPublished?: boolean;
  mediaIds?: string[] | null;
}

export interface ChangePostStatusRequest {
  isPublished: boolean;
}
