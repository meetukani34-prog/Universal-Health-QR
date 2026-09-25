
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: contentType});
    const url = URL.createObjectURL(blob);
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
      showToast('Pop-up blocked! Please allow pop-ups for this site.', 'error');
    }
  } catch(e) {
    console.error('Certificate view error:', e);
    showToast('Failed to open certificate', 'error');
  }
};

