/* global window */
import { h } from './element';
import { bind, mouseMoveUp, bindTouch } from './event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';
// import ContextMenu from './contextmenu';
import Table from './table';
import ModalValidation from './modal_validation';
import SortFilter from './sort_filter';
import { xtoast } from './message';
import { cssPrefix } from '../config';
import { formulas } from '../core/formula';

function scrollbarMove() {
  const {
    data, verticalScrollbar, horizontalScrollbar,
  } = this;
  const {
    l, t, left, top, width, height,
  } = data.getSelectedRect();
  const tableOffset = this.getTableOffset();
  // console.log(',l:', l, ', left:', left, ', tOffset.left:', tableOffset.width);
  if (Math.abs(left) + width > tableOffset.width) {
    horizontalScrollbar.move({ left: l + width - tableOffset.width });
  } else {
    const fsw = data.freezeTotalWidth();
    if (left < fsw) {
      horizontalScrollbar.move({ left: l - 1 - fsw });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (Math.abs(top) + height > tableOffset.height) {
    verticalScrollbar.move({ top: t + height - tableOffset.height - 1 });
  } else {
    const fsh = data.freezeTotalHeight();
    if (top < fsh) {
      verticalScrollbar.move({ top: t - 1 - fsh });
    }
  }
}

// 单元格选择器选中时/单元格选择器移动时触发
function selectorSet(multiple, ri, ci, indexesUpdated = true, moving = false) {
  if (ri === -1 && ci === -1) return;
  // console.log(multiple, ', ri:', ri, ', ci:', ci);
  const {
    table, selector,
  } = this;

  if (multiple) {
    selector.setEnd(ri, ci, moving);
  } else {
    selector.set(ri, ci, indexesUpdated);
  }

  // 单元格被选中时触发用户自定义事件
  if (typeof this.customEvents.onSelected === 'function') {
    this.customEvents.onSelected(ri, ci, multiple, moving);
  }

  table.render();
}

// multiple: boolean
// direction: left | right | up | down | row-first | row-last | col-first | col-last
function selectorMove(multiple, direction) {
  const {
    selector, data,
  } = this;
  const { rows, cols } = data;
  let [ri, ci] = selector.indexes;
  const { eri, eci } = selector.range;
  if (multiple) {
    [ri, ci] = selector.moveIndexes;
  }
  // console.log('selector.move:', ri, ci);
  if (direction === 'left') {
    if (ci > 0) ci -= 1;
  } else if (direction === 'right') {
    if (eci !== ci) ci = eci;
    if (ci < cols.len - 1) ci += 1;
  } else if (direction === 'up') {
    if (ri > 0) ri -= 1;
  } else if (direction === 'down') {
    if (eri !== ri) ri = eri;
    if (ri < rows.len - 1) ri += 1;
  } else if (direction === 'row-first') {
    ci = 0;
  } else if (direction === 'row-last') {
    ci = cols.len - 1;
  } else if (direction === 'col-first') {
    ri = 0;
  } else if (direction === 'col-last') {
    ri = rows.len - 1;
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

// private methods
function overlayerMousemove(evt) {
  // console.log('x:', evt.offsetX, ', y:', evt.offsetY);
  if (evt.buttons !== 0) return;
  if (evt.target.className === `${cssPrefix}-resizer-hover`) return;
  const { offsetX, offsetY } = evt;
  const {
    rowResizer, colResizer, tableEl, data,
  } = this;
  const { rows, cols } = data;
  if (offsetX > cols.indexWidth && offsetY > rows.height) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(evt.offsetX, evt.offsetY);
  if (cRect.ri >= 0 && cRect.ci === -1) {
    cRect.width = cols.indexWidth;
    rowResizer.show(cRect, {
      width: tRect.width,
    });
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === -1 && cRect.ci >= 0) {
    cRect.height = rows.height;
    colResizer.show(cRect, {
      height: tRect.height,
    });
  } else {
    colResizer.hide();
  }
}

// 触控板&滚轮事件
function overlayerMousescroll(evt) {
  const { verticalScrollbar, horizontalScrollbar, data } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();
  // console.log('evt:::', evt.wheelDelta, evt.detail * 40);
  const { rows, cols } = data;

  // deltaY for vertical delta
  let { deltaY } = evt;
  const { deltaX } = evt;

  if (evt.detail) deltaY = evt.detail * 40;

  const velocity = 0.03;

  if (deltaY > 1) {
    // up
    const ri = data.scroll.ri + 1;
    if (ri < rows.len) {
      verticalScrollbar.move({ top: top + deltaY * velocity * rows.getHeight(ri) - 1 });
    }
  } else if (deltaY < -1) {
    // down
    const ri = data.scroll.ri - 1;
    if (ri >= 0) {
      verticalScrollbar.move({ top: ri === 0 ? 0 : top - rows.getHeight(ri) * -deltaY * velocity });
    }
  } else if (deltaX > 1) {
    // left
    const ci = data.scroll.ci + 1;
    if (ci < cols.len) {
      horizontalScrollbar.move({ left: left + cols.getWidth(ci) - 1 });
    }
  } else if (deltaX < -1) {
    // right
    const ci = data.scroll.ci - 1;
    if (ci >= 0) {
      horizontalScrollbar.move({
        left: ci === 0 ? 0 : left - cols.getWidth(ci),
      });
    }
  }
}

function overlayerTouch(direction, distance) {
  const { verticalScrollbar, horizontalScrollbar } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();

  if (direction === 'left' || direction === 'right') {
    horizontalScrollbar.move({ left: left - distance });
  } else if (direction === 'up' || direction === 'down') {
    verticalScrollbar.move({ top: top - distance });
  }
}

function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  const erth = data.exceptRowTotalHeight(0, -1);
  // console.log('erth:', erth);
  verticalScrollbar.set(height, data.rows.totalHeight() - erth);
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.cols.totalWidth());
  }
}

function sheetFreeze() {
  const {
    selector, data, editor,
  } = this;
  const [ri, ci] = data.freeze;
  if (ri > 0 || ci > 0) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    editor.setFreezeLengths(fwidth, fheight);
  }
  selector.resetAreaOffset();
}

// 表格重置
function sheetReset() {
  const {
    tableEl,
    overlayerEl,
    overlayerCEl,
    table,
    selector,
    el,
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset({
    width: tOffset.width,
    height: tOffset.height,
    left: tOffset.left,
    top: tOffset.top - 1,
  });
  el.css('width', `${vRect.width}px`);
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
  sheetFreeze.call(this);
  table.render();
  selector.reset();
}

function autofilter() {
  const { data } = this;
  data.autofilter();
  sheetReset.call(this);
}

function overlayerMousedown(evt) {
  // console.log(':::::overlayer.mousedown:', evt.detail, evt.button, evt.buttons, evt.shiftKey);
  // console.log('evt.target.className:', evt.target.className);
  const {
    selector, data, table, sortFilter,
  } = this;
  const { offsetX, offsetY } = evt;
  const isAutofillEl = evt.target.className === `${cssPrefix}-selector-corner`;
  const cellRect = data.getCellRectByXY(offsetX, offsetY);

  const {
    left, top, width, height,
  } = cellRect;
  let { ri, ci } = cellRect;
  // sort or filter
  const { autoFilter } = data;
  if (autoFilter.includes(ri, ci)) {
    if (left + width - 20 < offsetX && top + height - 20 < offsetY) {
      const items = autoFilter.items(ci, (r, c) => data.rows.getCell(r, c));
      sortFilter.set(ci, items, autoFilter.getFilter(ci), autoFilter.getSort(ci));
      sortFilter.setOffset({ left, top: top + height + 2 });
      return;
    }
  }

  // console.log('ri:', ri, ', ci:', ci);
  if (!evt.shiftKey) {
    // console.log('selectorSetStart:::');
    if (isAutofillEl) {
      selector.showAutofill(ri, ci);
    } else {
      selectorSet.call(this, false, ri, ci);
    }

    // mouse move up
    mouseMoveUp(window, (e) => {
      // console.log('mouseMoveUp::::');
      ({ ri, ci } = data.getCellRectByXY(e.offsetX, e.offsetY));
      if (isAutofillEl) {
        selector.showAutofill(ri, ci);
      } else if (e.buttons === 1 && !e.shiftKey) {
        selectorSet.call(this, true, ri, ci, true, true);
      }
    }, () => {
      if (isAutofillEl) {
        if (data.autofill(selector.arange, 'all', msg => xtoast('Tip', msg))) {
          table.render();
        }
      }
      selector.hideAutofill();
      //  toolbarChangePaintformatPaste.call(this);
    });
  }

  if (!isAutofillEl && evt.buttons === 1) {
    if (evt.shiftKey) {
      // console.log('shiftKey::::');
      selectorSet.call(this, true, ri, ci);
    }
  }
}

function editorSetOffset() {
  const { editor, data } = this;
  const sOffset = data.getSelectedRect();
  const tOffset = this.getTableOffset();
  let sPosition = 'top';
  // console.log('sOffset:', sOffset, ':', tOffset);
  if (sOffset.top > tOffset.height / 2) {
    sPosition = 'bottom';
  }
  editor.setOffset(sOffset, sPosition);
}

// 单元格编辑处理函数
function editorSet() {
  if (this.data.settings.editable) {
    const { editor, selector, data } = this;
    editorSetOffset.call(this);
    selector.hide(); // 单元格编辑时，选中器隐藏
    editor.setCell(data.getSelectedCell(), data.getSelectedValidator());
  }
}

// 纵向滚动事件
function verticalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrolly(distance, () => {
    selector.resetBRLAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

// 横向滚动事件
function horizontalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrollx(distance, () => {
    selector.resetBRTAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function rowResizerFinished(cRect, distance) {
  const { ri } = cRect;
  const { table, selector, data } = this;
  data.rows.setHeight(ri, distance);
  table.render();
  selector.resetAreaOffset();
  verticalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci } = cRect;
  const { table, selector, data } = this;
  data.cols.setWidth(ci, distance);
  // console.log('data:', data);
  table.render();
  selector.resetAreaOffset();
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function dataSetCellText(text, state = 'finished') {
  if (this.data.settings.editable) {
    const { data, table } = this;
    // const [ri, ci] = selector.indexes;
    data.setSelectedCellText(text, state);
    if (state === 'finished') table.render();
  }
}

function insertDeleteRowColumn(type) {
  const { data } = this;
  if (type === 'insert-row') {
    data.insert('row');
  } else if (type === 'delete-row') {
    data.delete('row');
  } else if (type === 'insert-column') {
    data.insert('column');
  } else if (type === 'delete-column') {
    data.delete('column');
  } else if (type === 'delete-cell') {
    data.deleteCell();
  } else if (type === 'delete-cell-format') {
    data.deleteCell('format');
  } else if (type === 'delete-cell-text') {
    data.deleteCell('text');
  } else if (type === 'cell-printable') {
    const { range } = this.selector;
    this.data.changeData(() => {
      range.each((i, j) => {
        const row = this.data.rows.get(i);
        if (row !== null) {
          const cell = this.data.rows.getCell(i, j);
          console.log('CELL', cell);
          if (cell !== null) {
            cell.printable = true;
          }
        }
      });
    });
  } else if (type === 'cell-non-printable') {
    const { range } = this.selector;
    this.data.changeData(() => {
      range.each((i, j) => {
        const row = this.data.rows.get(i);
        if (row !== null) {
          const cell = this.data.rows.getCell(i, j);
          console.log('CELL', cell);
          if (cell !== null) {
            cell.printable = false;
          }
          // cell.css('background-color','black')
        }
      });
    });
  } else if (type === 'cell-editable') {
    const { range } = this.selector;
    this.data.changeData(() => {
      range.each((i, j) => {
        const row = this.data.rows.get(i);
        if (row !== null) {
          const cell = this.data.rows.getCell(i, j);
          console.log('CELL', cell);
          if (cell !== null) {
            cell.editable = true;
          }
        }
      });
    });
  } else if (type === 'cell-non-editable') {
    const { range } = this.selector;
    this.data.changeData(() => {
      range.each((i, j) => {
        const row = this.data.rows.get(i);
        if (row !== null) {
          const cell = this.data.rows.getCell(i, j);
          console.log('CELL', cell);
          if (cell !== null) {
            cell.editable = false;
          }
        }
      });
    });
  }
  sheetReset.call(this);
}

function sortFilterChange(ci, order, operator, value) {
  // console.log('sort:', sortDesc, operator, value);
  this.data.setAutoFilter(ci, order, operator, value);
  sheetReset.call(this);
}

function sheetInitEvents() {
  const {
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
    // contextMenu,
    data,
    // toolbar,
    modalValidation,
    sortFilter,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      // the left mouse button: mousedown → mouseup → click
      // the right mouse button: mousedown → contenxtmenu → mouseup
      if (evt.buttons === 2) { // 右键
        // if (data.xyInSelectedRect(evt.offsetX, evt.offsetY)) {
        //   contextMenu.setPosition(evt.offsetX, evt.offsetY);
        //   evt.stopPropagation();
        // } else {
        //   contextMenu.hide();
        // }
      } else if (evt.detail === 2) { // 鼠标双击事件
        editorSet.call(this);
      } else {
        editor.clear();
        overlayerMousedown.call(this, evt);
      }

      if (typeof this.customEvents.click === 'function') {
        this.customEvents.click(evt);
      }
    }).on('mousewheel.stop', (evt) => {
      evt.preventDefault(); // mac下禁止左右翻页，禁止回弹效果
      overlayerMousescroll.call(this, evt);
    });

  // slide on mobile
  bindTouch(overlayerEl.el, {
    move: (direction, d) => {
      overlayerTouch.call(this, direction, d);
    },
  });

  // toolbar change
  // toolbar.change = (type, value) => toolbarChange.call(this, type, value);

  // sort filter ok
  sortFilter.ok = (ci, order, o, v) => sortFilterChange.call(this, ci, order, o, v);

  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };
  // scrollbar move callback
  verticalScrollbar.moveFn = (distance, evt) => {
    verticalScrollbarMove.call(this, distance, evt);
  };
  horizontalScrollbar.moveFn = (distance, evt) => {
    horizontalScrollbarMove.call(this, distance, evt);
  };
  // editor
  editor.change = (state, itext) => {
    dataSetCellText.call(this, itext, state);
  };
  // modal validation
  modalValidation.change = (action, ...args) => {
    if (action === 'save') {
      data.addValidation(...args);
    } else {
      data.removeValidation();
    }
  };
  // contextmenu
  // contextMenu.itemClick = (type) => {
  //   // console.log('type:', type);
  //   if (type === 'validation') {
  //     modalValidation.setValue(data.getSelectedValidation());
  //   } else if (type === 'copy') {
  //     copy.call(this);
  //   } else if (type === 'cut') {
  //     cut.call(this);
  //   } else if (type === 'paste') {
  //     paste.call(this, 'all');
  //   } else if (type === 'paste-value') {
  //     paste.call(this, 'text');
  //   } else if (type === 'paste-format') {
  //     paste.call(this, 'format');
  //   } else {
  //     insertDeleteRowColumn.call(this, type);
  //   }
  // };

  bind(window, 'resize', () => {
    this.reload();
  });

  bind(window, 'click', (evt) => {
    this.focusing = overlayerEl.contains(evt.target);
  });

  // 焦点时监听键盘事件
  // for selector
  bind(window, 'keydown', (evt) => {
    if (!this.focusing) return;
    const keyCode = evt.keyCode || evt.which;
    const {
      key, ctrlKey, shiftKey, altKey, metaKey,
    } = evt;

    // 用户自定义监听事件
    if (typeof this.customEvents.keyDown === 'function') {
      this.customEvents.keyDown(evt);
    }

    // console.log('keydown.evt: ', keyCode);
    if (ctrlKey || metaKey) {
      // const { sIndexes, eIndexes } = selector;
      let what = 'all';
      if (shiftKey) what = 'text';
      if (altKey) what = 'format';
      switch (keyCode) {
        case 90:
          // undo: ctrl + z
          this.undo();
          evt.preventDefault();
          break;
        case 89:
          // redo: ctrl + y
          this.redo();
          evt.preventDefault();
          break;
        case 67:
          // ctrl + c
          copy.call(this);
          evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          cut.call(this);
          evt.preventDefault();
          break;
        case 85:
          // ctrl + u
          // toolbar.trigger('underline');
          evt.preventDefault();
          break;
        case 86:
          // ctrl + v
          // paste.call(this, what);
          // evt.preventDefault();
          break;
        case 37:
          // ctrl + left
          selectorMove.call(this, shiftKey, 'row-first');
          evt.preventDefault();
          break;
        case 38:
          // ctrl + up
          selectorMove.call(this, shiftKey, 'col-first');
          evt.preventDefault();
          break;
        case 39:
          // ctrl + right
          selectorMove.call(this, shiftKey, 'row-last');
          evt.preventDefault();
          break;
        case 40:
          // ctrl + down
          selectorMove.call(this, shiftKey, 'col-last');
          evt.preventDefault();
          break;
        case 32:
          // ctrl + space, all cells in col
          selectorSet.call(this, false, -1, data.selector.ci, false);
          evt.preventDefault();
          break;
        case 66:
          // ctrl + B
          //  toolbar.trigger('bold');
          break;
        case 73:
          // ctrl + I
          // toolbar.trigger('italic');
          break;
        default:
          break;
      }
    } else {
      // console.log('evt.keyCode:', evt.keyCode);
      switch (keyCode) {
        case 32:
          if (shiftKey) {
            // shift + space, all cells in row
            selectorSet.call(this, false, data.selector.ri, -1, false);
          }
          break;
        case 27: // esc
          // contextMenu.hide();
          break;
        case 37: // left
          selectorMove.call(this, shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          editor.clear();
          // shift + tab => move left
          // tab => move right
          selectorMove.call(this, false, shiftKey ? 'left' : 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          editor.clear();
          // shift + enter => move up
          // enter => move down
          selectorMove.call(this, false, shiftKey ? 'up' : 'down');
          evt.preventDefault();
          break;
        case 8: // backspace
          insertDeleteRowColumn.call(this, 'delete-cell-text');
          evt.preventDefault();
          break;
        default:
          break;
      }

      if (key === 'Delete') {
        insertDeleteRowColumn.call(this, 'delete-cell-text');
        evt.preventDefault();
      } else if ((keyCode >= 65 && keyCode <= 90)
        || (keyCode >= 48 && keyCode <= 57)
        || (keyCode >= 96 && keyCode <= 105)
        || evt.key === '='
      ) {
        // 先注释掉，否则 editable 不生效
        dataSetCellText.call(this, evt.key, 'input');
        editorSet.call(this);
      } else if (keyCode === 113) {
        // F2
        editorSet.call(this);
      }
    }
  });
}

export default class Sheet {
  constructor(targetEl, data) {
    this.el = h('div', `${cssPrefix}-sheet`);
    targetEl.children(this.el);

    this.data = data;

    // 需要重构优化
    this.data.settings.view.width = () => targetEl.offset().width;
    this.data.settings.view.height = () => targetEl.offset().height;

    // table
    this.tableEl = h('canvas', `${cssPrefix}-table`);
    // resizer
    this.rowResizer = new Resizer(false, data.rows.height);
    this.colResizer = new Resizer(true, data.cols.minWidth);
    // 实例化滚动条
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // event
    this.customEvents = {};
    // editor
    this.editor = new Editor(
      formulas,
      () => this.getTableOffset(),
      data.rows.height,
    );
    // data validation
    this.modalValidation = new ModalValidation();
    // selector
    this.selector = new Selector(data);
    this.overlayerCEl = h('div', `${cssPrefix}-overlayer-content`)
      .children(
        this.editor.el,
        this.selector.el,
      );
    this.overlayerEl = h('div', `${cssPrefix}-overlayer`)
      .child(this.overlayerCEl);
    // sortFilter
    this.sortFilter = new SortFilter();
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
      // this.contextMenu.el,
      this.modalValidation.el,
      this.sortFilter.el,
    );

    // table
    this.table = new Table(this.tableEl.el, data);
    sheetInitEvents.call(this);
    sheetReset.call(this);
    // init selector [0, 0]
    selectorSet.call(this, false, 0, 0);
  }

  loadData(data) {
    this.data.setData(data);
    sheetReset.call(this);
    return this;
  }

  // freeze rows or cols
  freeze(ri, ci) {
    const { data } = this;
    data.setFreeze(ri, ci);
    sheetReset.call(this);
    return this;
  }

  undo() {
    this.data.undo();
    sheetReset.call(this);
  }

  redo() {
    this.data.redo();
    sheetReset.call(this);
  }

  reload() {
    sheetReset.call(this);
    return this;
  }

  getRect() {
    const { data } = this;
    return { width: data.viewWidth(), height: data.viewHeight() };
  }

  getTableOffset() {
    const { rows, cols } = this.data;
    const { width, height } = this.getRect();
    return {
      width: width - cols.indexWidth,
      height: height - rows.height,
      left: cols.indexWidth,
      top: rows.height,
    };
  }
}
