(function(App) {
  'use strict';

  async function loadAdminItems() {
    const list = document.getElementById('adminItemsList');
    if (!list) return;

    const btn = document.getElementById('addItemBtn');
    if (btn) {
      btn.removeEventListener('click', navigateToItemEditorCreate);
      btn.addEventListener('click', navigateToItemEditorCreate);
    }

    list.innerHTML = '<div class="loading">Cargando inventario...</div>';
    try {
      const items = await API.getItems();
      App.State.items = items;
      renderAdminItems(items);
    } catch (err) {
      list.innerHTML = App.UI.renderErrorEmptyState(err);
    }
  }

  function renderAdminItems(items) {
    const list = document.getElementById('adminItemsList');
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay materiales en el inventario.</div>';
      return;
    }

    const html = items.map((item) => {
      const totalStock = Number(item.total_stock) || 0;
      const availableStock = Number(item.available_stock) || 0;
      const isLow = totalStock > 0 && availableStock / totalStock <= 0.2;
      const labName = item.lab_name || 'Sin Laboratorio';
      return `
        <div class="admin-item">
          <div class="admin-item__info">
            <div class="admin-item__title">${item.name}</div>
            <div class="admin-item__meta">
              Lab: <strong>${labName}</strong><br>
              <span style="color: ${isLow ? 'var(--danger-color, #ef4444)' : 'inherit'}">Disponible: <strong>${availableStock}</strong></span> | Total: ${totalStock}
            </div>
          </div>
          <div class="admin-item__actions">
            <button class="btn btn--outline btn--sm" onclick="App.Router.navigateToItemEditor('${item.id}')"><i class="bi bi-pencil"></i> Editar</button>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = html;
  }

  function navigateToItemEditorCreate() {
    App.Router.navigateToItemEditor(null);
  }

  App.Router.navigateToItemEditor = function(itemId) {
    window.location.hash = itemId ? '#item-editor/' + itemId : '#item-editor';
  };

  App.AdminItems = {
    loadAdminItems,
    renderAdminItems
  };

})(window.App = window.App || {});
