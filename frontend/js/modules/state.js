(function(App) {
  'use strict';
  
  App.State = {
    currentUser: null,
    labs: [],
    items: [],
    faculties: [],
    programs: [],
    itemEditorMode: 'create',
    itemEditorId: null,
    adminFacultiesPage: 1,
    adminProgramsPage: 1,
    currentCalendarDate: new Date()
  };

})(window.App = window.App || {});
