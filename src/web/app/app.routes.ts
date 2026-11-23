import { Routes } from '@angular/router';
import { HomeComponent } from './screens/home/home.component';
import { FlashcardComponent } from './screens/flashcard/flashcard.component';
import { ListenComponent } from './screens/listen/listen.component';
import { MyWordsComponent } from './screens/my-words/my-words.component';
import { PlaceholderComponent } from './screens/placeholders/placeholder.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  // Placeholders until tasks 10 and 11 replace them.
  { path: 'session/flashcard/:categoryId', component: FlashcardComponent },
  { path: 'session/listen', component: ListenComponent },
  { path: 'my-words', component: MyWordsComponent },
  { path: '**', redirectTo: '' },
];
