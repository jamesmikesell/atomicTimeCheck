import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeDisplayComponent } from './component/time-display/time-display.component';

const routes: Routes = [
    {
        path: '',
        component: TimeDisplayComponent
    },
    {
        path: '**',
        redirectTo: ''
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
