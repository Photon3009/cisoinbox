interface Email {
  id: number;
  date: string;
  subject: string;
  from: string;
  to: string;
  account: string;
  accountEmail: string;
  category: string;
  body: string;
    suggestedReply?: string; 
}

const CATEGORY_LABELS = {
  INTERESTED: 'Interested',
  MEETING_BOOKED: 'Meeting Booked',
  NOT_INTERESTED: 'Not Interested',
  SPAM: 'Spam',
  OUT_OF_OFFICE: 'Out of Office',
};
